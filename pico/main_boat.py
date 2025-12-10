from machine import Pin, PWM, ADC, Timer
import time
import ujson
from fasapico import * # Inclut connect_to_wifi, scale_to_int, MQTTClientSimple, Grove_LCD_I2C, bmm150, Stepper, log_info, log_err etc

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
# Topics Actionneurs
TOPIC_ACT_SAFRAN = f"{TOPIC_BASE}/actionneurs/safran"
TOPIC_ACT_VOILE = f"{TOPIC_BASE}/actionneurs/voile"
TOPIC_ACT_LCD = f"{TOPIC_BASE}/actionneurs/lcd"
TOPIC_ACT_MAT = f"{TOPIC_BASE}/actionneurs/mat" # Peut etre garde pour compatibilite

# Topics Capteurs/Status
TOPIC_CAP_CAP = f"{TOPIC_BASE}/capteurs/cap"
TOPIC_CAP_POT = f"{TOPIC_BASE}/capteurs/potentiometer"
TOPIC_STATUS = f"{TOPIC_BASE}/status"

# --- Configuration Materielle ---

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

# 2. Moteur Pas-a-pas Voile (Pins 10, 11, 12, 13 via classe Stepper)
voile = Stepper() # Utilise les pins par defaut 10, 11, 12, 13

# 3. LCD I2C (Pins 0/1)
lcd = None
try:
    lcd = Grove_LCD_I2C()
    lcd.write("Pret")
except Exception as e:
    print(f"[ERREUR] Init LCD: {e}")

def update_lcd(text):
    if not lcd: return
    lcd.clear()
    lines = text.split('\n') # Decoupage manuel
    # Auto-decoupage si besoin
    if len(lines) == 1 and len(text) > 16:
        lines = [text[:16], text[16:32]]
        
    if len(lines) > 0:
        lcd.cursor_position(0, 0)
        lcd.write(lines[0][:16])
    if len(lines) > 1:
        lcd.cursor_position(0, 1)
        lcd.write(lines[1][:16])
    print(f"[INFO] LCD: {text}")

# 4. Boussole (BMM150)
compass = None
try:
    # Init Boussole, verification de l'init capteur
    compass = bmm150(sdaPin=0, sclPin=1)
    if compass.sensor_init() != 0:
       print("[ERREUR] Echec Init Boussole")
    else:
       compass.set_operation_mode(bmm150.POWERMODE_NORMAL) # Mode normal
except Exception as e:
    print(f"[ERREUR] Setup Boussole: {e}")

def read_heading():
    if not compass: return 0
    try:
        return int(compass.get_compass_degree())
    except Exception as e:
        print(f"[ERREUR] Lecture Boussole: {e}")
        return 0

# 5. Potentiometre
pot = ADC(27)
def read_pot():
    raw = pot.read_u16()
    return scale_to_int(raw, 0, 65535, 100, 0) # 100-0% inversé

# --- Logique MQTT ---
clientMQTT = None

def on_message_callback(topic, msg):
    try:
        topic_str = topic.decode() if isinstance(topic, bytes) else topic
        msg_str = msg.decode() if isinstance(msg, bytes) else msg
        print(f"[INFO] RX {topic_str}: {msg_str}")
        
        # Actions selon le topic
        if topic_str == TOPIC_ACT_SAFRAN:
            set_servo_angle(safran_pwm, int(float(msg_str)))
        elif topic_str == TOPIC_ACT_VOILE:
            voile.move(int(float(msg_str)))
        elif topic_str == TOPIC_ACT_LCD:
            update_lcd(msg_str)
        elif topic_str == TOPIC_ACT_MAT:
            voile.move(int(float(msg_str)))
        
        # Support format exemple utilsateur: "mat|30"
        if "mat" in msg_str and "|" in msg_str:
             parts = msg_str.split('|')
             if parts[0] == "mat": voile.move(int(float(parts[1])))
        if "lcd" in msg_str and "|" in msg_str:
             parts = msg_str.split('|')
             if parts[0] == "lcd": update_lcd(parts[1])
             
    except Exception as e:
        print(f"[ERREUR] Callback: {e}")

def connect_mqtt():
    global clientMQTT
    try:
        print(f"[INFO] Connexion {SERVER_BROKER}...")
        client = MQTTClientSimple(f"pico_{NOM_BATEAU}", SERVER_BROKER, user=None, password=None, port=PORT_BROKER)
        client.set_callback(on_message_callback)
        client.connect()
        client.subscribe(TOPIC_ACT_SAFRAN)
        client.subscribe(TOPIC_ACT_VOILE)
        client.subscribe(TOPIC_ACT_LCD)
        client.subscribe(TOPIC_ACT_MAT)
        return client
    except Exception as e:
        print(f"[ERREUR] Connexion MQTT: {e}")
        return None

# --- Boucle Principale avec Timers ---

def check_msg_task(t):
    if clientMQTT:
        try: clientMQTT.check_msg()
        except OSError: pass # La reconnexion est gestion dans la boucle principale si besoin

def publish_sensors_task(t):
    if clientMQTT:
        try:
            clientMQTT.publish(TOPIC_CAP_CAP, str(read_heading()))
            clientMQTT.publish(TOPIC_CAP_POT, str(read_pot()))
        except Exception as e:
            print(f"[ERREUR] Publication: {e}")

def main():
    global clientMQTT
    
    # Connexion WiFi
    try:
        connect_to_wifi(WIFI_SSID, WIFI_PWD, debug=True)
    except Exception as e:
        print(f"[ERREUR] WiFi: {e}")
        time.sleep(5)
        return

    clientMQTT = connect_mqtt()
    
    # Timers
    # Verifier MQTT toutes les 10ms
    t_mqtt = Timer(period=10, mode=Timer.PERIODIC, callback=check_msg_task)
    # Publier capteurs toutes les 1s
    t_pub = Timer(period=1000, mode=Timer.PERIODIC, callback=publish_sensors_task)
    
    # Boucle de surveillance connexion
    while True:
        if not clientMQTT:
             clientMQTT = connect_mqtt()
        time.sleep(5)

if __name__ == "__main__":
    main()
