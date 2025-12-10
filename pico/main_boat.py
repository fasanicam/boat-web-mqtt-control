from machine import Pin, PWM, ADC, Timer
import time
import ujson
from fasapico import * # Includes connect_to_wifi, scale_to_int, MQTTClientSimple, Grove_LCD_I2C, bmm150, log_info, log_err etc (if added)

# --- CONSTANTES A ADAPTER ---
try:
    from settings import WIFI_SSID, WIFI_PWD, SERVER_BROKER, PORT_BROKER, NOM_BATEAU
except ImportError:
    WIFI_SSID = "icam_iot"
    WIFI_PWD = "Summ3#C@mp2022"
    SERVER_BROKER = "mqtt.dev.icam.school"
    PORT_BROKER = 1883
    NOM_BATEAU = "monBateau01" 

# --- Topics MQTT ---
TOPIC_BASE = f"bzh/iot/boat/{NOM_BATEAU}"
# Specific action topics
TOPIC_ACT_SAFRAN = f"{TOPIC_BASE}/actionneurs/safran"
TOPIC_ACT_VOILE = f"{TOPIC_BASE}/actionneurs/voile"
TOPIC_ACT_LCD = f"{TOPIC_BASE}/actionneurs/lcd"
TOPIC_ACT_MAT = f"{TOPIC_BASE}/actionneurs/mat" # New for stepper

# Status/Sensors topics
TOPIC_CAP_CAP = f"{TOPIC_BASE}/capteurs/cap"
TOPIC_CAP_POT = f"{TOPIC_BASE}/capteurs/potentiometer"
TOPIC_STATUS = f"{TOPIC_BASE}/status"

# --- Hardware Setup ---

# 1. Servo Safran (Pin 7)
safran_pwm = PWM(Pin(7))
safran_pwm.freq(50) 
def set_servo_angle(pwm_obj, angle):
    # Angle -90..90 -> Servo 0..180
    servo_angle = angle + 90
    servo_angle = max(0, min(180, servo_angle))
    # Map 0..180 -> 3000..6500
    duty = int(3000 + (servo_angle / 180) * (6500 - 3000))
    pwm_obj.duty_u16(duty)

# 2. Servo Voile (Pin 17)
voile_pwm = PWM(Pin(17))
voile_pwm.freq(50)

# 3. Stepper (Pins 10, 11, 12, 13)
stepper_pins = [Pin(10, Pin.OUT), Pin(11, Pin.OUT), Pin(12, Pin.OUT), Pin(13, Pin.OUT)]

def runStepper(nbPas):
    if nbPas > 0:
        steps_sequence = [[1,0,0,0], [0,1,0,0], [0,0,1,0], [0,0,0,1]]
    else:
        steps_sequence = [[0,0,0,1], [0,0,1,0], [0,1,0,0], [1,0,0,0]]
        
    for _ in range(abs(nbPas)):
        for step in steps_sequence:
            for i in range(4):
                stepper_pins[i].value(step[i])
            time.sleep_ms(5)

# 4. LCD I2C (Pins 0/1)
lcd = None
try:
    lcd = Grove_LCD_I2C()
    lcd.write("Ready")
except Exception as e:
    print(f"[ERROR] LCD Init: {e}")

def update_lcd(text):
    if not lcd: return
    lcd.clear()
    lines = text.split('\n') # Split manual newlines
    # Auto-split if needed and one line
    if len(lines) == 1 and len(text) > 16:
        lines = [text[:16], text[16:32]]
        
    if len(lines) > 0:
        lcd.cursor_position(0, 0)
        lcd.write(lines[0][:16])
    if len(lines) > 1:
        lcd.cursor_position(0, 1)
        lcd.write(lines[1][:16])
    print(f"[INFO] LCD: {text}")

# 5. Compass (BMM150)
compass = None
try:
    # Assuming same bus or pins as LCD? or shared. 
    # bmm150 class in fasapico takes sdaPin, sclPin
    compass = bmm150(sdaPin=0, sclPin=1)
    # Init handled in constructor or need explicit init?
    # Checked fasapico code: __init__ sets up I2C.
    # But usually need to call sensor_init() or similar if not auto?
    # fasapico bmm150 has sensor_init(). Let's call it.
    if compass.sensor_init() != 0:
       print("[ERROR] Compass Init Failed")
    else:
       compass.set_operation_mode(bmm150.POWERMODE_NORMAL) # Ensure normal mode
except Exception as e:
    print(f"[ERROR] Compass Setup: {e}")

def read_heading():
    if not compass: return 0
    try:
        return int(compass.get_compass_degree())
    except Exception as e:
        print(f"[ERROR] Compass Read: {e}")
        return 0

# 6. Potentiometer
pot = ADC(27)
def read_pot():
    raw = pot.read_u16()
    return scale_to_int(raw, 0, 65535, 100, 0) # 0-100%

# --- MQTT Logic ---
clientMQTT = None

def on_message_callback(topic, msg):
    try:
        topic_str = topic.decode() if isinstance(topic, bytes) else topic
        msg_str = msg.decode() if isinstance(msg, bytes) else msg
        print(f"[INFO] RX {topic_str}: {msg_str}")
        
        # Determine action based on topic OR content (hybrid approach)
        if topic_str == TOPIC_ACT_SAFRAN:
            set_servo_angle(safran_pwm, int(float(msg_str)))
        elif topic_str == TOPIC_ACT_VOILE:
            set_servo_angle(voile_pwm, int(float(msg_str)))
        elif topic_str == TOPIC_ACT_LCD:
            update_lcd(msg_str)
        elif topic_str == TOPIC_ACT_MAT:
            runStepper(int(float(msg_str)))
        
        # Support user's example format: "mat|30"
        if "mat" in msg_str and "|" in msg_str:
             parts = msg_str.split('|')
             if parts[0] == "mat": runStepper(int(float(parts[1])))
        if "lcd" in msg_str and "|" in msg_str:
             parts = msg_str.split('|')
             if parts[0] == "lcd": update_lcd(parts[1])
             
    except Exception as e:
        print(f"[ERROR] Callback: {e}")

def connect_mqtt():
    global clientMQTT
    try:
        print(f"[INFO] Connecting {SERVER_BROKER}...")
        client = MQTTClientSimple(f"pico_{NOM_BATEAU}", SERVER_BROKER, user=None, password=None, port=PORT_BROKER)
        client.set_callback(on_message_callback)
        client.connect()
        client.subscribe(TOPIC_ACT_SAFRAN)
        client.subscribe(TOPIC_ACT_VOILE)
        client.subscribe(TOPIC_ACT_LCD)
        client.subscribe(TOPIC_ACT_MAT)
        # Also subscribe to base if needed, but specificity is better
        return client
    except Exception as e:
        print(f"[ERROR] MQTT Connect: {e}")
        return None

# --- Main Logic with Timers ---

def check_msg_task(t):
    if clientMQTT:
        try: clientMQTT.check_msg()
        except OSError: pass # Reconnect handled in main loop or logic

def publish_sensors_task(t):
    if clientMQTT:
        try:
            # We don't have a reliable heading yet if get_compass_degree isn't confirmed
            # But let's publish 0 or mock
            clientMQTT.publish(TOPIC_CAP_CAP, str(read_heading()))
            clientMQTT.publish(TOPIC_CAP_POT, str(read_pot()))
            # print("Published sensors")
        except Exception as e:
            print(f"[ERROR] Publish: {e}")

def main():
    global clientMQTT
    
    # WiFi Connect
    try:
        connect_to_wifi(WIFI_SSID, WIFI_PWD, debug=True)
    except Exception as e:
        print(f"[ERROR] WiFi: {e}")
        time.sleep(5)
        return

    clientMQTT = connect_mqtt()
    
    # Timers
    # Check MQTT every 10ms
    t_mqtt = Timer(period=10, mode=Timer.PERIODIC, callback=check_msg_task)
    # Publish every 1s
    t_pub = Timer(period=1000, mode=Timer.PERIODIC, callback=publish_sensors_task)
    
    # Check connection loop
    while True:
        if not clientMQTT:
             clientMQTT = connect_mqtt()
        time.sleep(5)

if __name__ == "__main__":
    main()
