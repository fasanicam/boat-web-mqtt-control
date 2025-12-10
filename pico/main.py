from mqtt import MQTTClientSimple
# from settings import * # Settings specifiques non fournis ici pour reference, on utilise des vars locales si besoin
from machine import *
import time
import ujson
import logging
# --- IMPORT FASAPICO ---
from fasapico import connect_to_wifi, scale_to_int
# --- IMPORT GROVE LCD ---
from grove_lcd_i2c import Grove_LCD_I2C

# --- CONSTANTES A ADAPTER ---
try:
    from settings import WIFI_SSID, WIFI_PWD, SERVER_BROKER, PORT_BROKER, NOM_BATEAU
except ImportError:
    WIFI_SSID = "icam_iot"
    WIFI_PWD = "Summ3#C@mp2022"
    SERVER_BROKER = "mqtt.dev.icam.school"
    PORT_BROKER = 1883
    NOM_BATEAU = "monBateau01" 

# --- Topics MQTT (Nouvelle Structure) ---
TOPIC_BASE = f"bzh/iot/boat/{NOM_BATEAU}"
TOPIC_ACT_SAFRAN = f"{TOPIC_BASE}/actionneurs/safran"
TOPIC_ACT_VOILE = f"{TOPIC_BASE}/actionneurs/voile"
TOPIC_ACT_LCD = f"{TOPIC_BASE}/actionneurs/lcd"

TOPIC_CAP_CAP = f"{TOPIC_BASE}/capteurs/cap"
TOPIC_CAP_POT = f"{TOPIC_BASE}/capteurs/potentiometer"
TOPIC_STATUS = f"{TOPIC_BASE}/status"

# --- Logging ---
def log_info(msg): print(f"[INFO] {msg}")
def log_err(msg): print(f"[ERROR] {msg}")

# --- Hardware Setup ---

# 1. Servo Safran (Pin 16)
safran_pwm = PWM(Pin(16))
safran_pwm.freq(50) 
def set_servo_angle(pwm_obj, angle):
    # Angle -90..90 -> Servo 0..180
    servo_angle = angle + 90
    servo_angle = max(0, min(180, servo_angle))
    # Map 0..180 -> 3000..6500 (approx 1ms-2ms) via float calculation or helpers
    duty = int(3000 + (servo_angle / 180) * (6500 - 3000))
    pwm_obj.duty_u16(duty)

# 2. Servo Voile (Pin 17) - Commandé en Angle maintenant
voile_pwm = PWM(Pin(17))
voile_pwm.freq(50)

# 3. LCD I2C (Pins 0/1) - Via Grove_LCD_I2C
lcd = None
try:
    # Init Grove LCD (sda=0, scl=1 sur Pico standard souvent I2C0)
    # Attention: Grove_LCD_I2C init utilise SoftI2C par defaut dans la lib fasapico sur pins 4,5
    # On doit forcer pins 0,1 si c'est le cablage. 
    # La classe Grove_LCD_I2C prend sda_pin et scl_pin en argument.
    lcd = Grove_LCD_I2C(sda_pin=0, scl_pin=1)
    lcd.write("Ready")
except Exception as e:
    log_err(f"LCD Fail: {e}")

def update_lcd(text):
    if not lcd: return
    lcd.clear()
    
    # Gestion du saut de ligne manuel ou auto deja fait par l'app web ou ici
    lines = text.split('\n')
    
    # Si pas de \n mais > 16 chars, on split auto ici aussi par sécurité
    if len(lines) == 1 and len(text) > 16:
        lines = [text[:16], text[16:32]]
        
    if len(lines) > 0:
        lcd.cursor_position(0, 0)
        lcd.write(lines[0][:16])
    if len(lines) > 1:
        lcd.cursor_position(0, 1)
        lcd.write(lines[1][:16])
    
    log_info(f"LCD: {text}")

# 4. Capteurs Simulés (A remplacer par drivers I2C reels)
def read_heading():
    import random
    return random.randint(0, 359)

pot = ADC(26)
def read_pot():
    # Avec fasapico.scale_to_int
    raw = pot.read_u16()
    return scale_to_int(raw, 0, 65535, 0, 100)

# --- MQTT Logic ---
clientMQTT = None

def on_message_callback(topic, msg):
    try:
        topic_str = topic.decode() if isinstance(topic, bytes) else topic
        msg_str = msg.decode() if isinstance(msg, bytes) else msg
        log_info(f"RX {topic_str}: {msg_str}")
        
        if topic_str == TOPIC_ACT_SAFRAN:
            set_servo_angle(safran_pwm, int(msg_str))
        elif topic_str == TOPIC_ACT_VOILE:
            set_servo_angle(voile_pwm, int(msg_str))
        elif topic_str == TOPIC_ACT_LCD:
            update_lcd(msg_str)
            
    except Exception as e:
        log_err(f"Callback Err: {e}")

def connect_mqtt():
    global clientMQTT
    try:
        log_info(f"Connecting {SERVER_BROKER}...")
        client = MQTTClientSimple(f"pico_{NOM_BATEAU}", SERVER_BROKER, user=None, password=None, port=PORT_BROKER)
        client.set_callback(on_message_callback)
        client.connect()
        client.subscribe(TOPIC_ACT_SAFRAN)
        client.subscribe(TOPIC_ACT_VOILE)
        client.subscribe(TOPIC_ACT_LCD)
        return client
    except Exception as e:
        log_err(f"Connect Logic Err: {e}")
        return None

# --- Main ---
def main():
    global clientMQTT
    
    # WiFi Connect via fasapico helper
    try:
        connect_to_wifi(WIFI_SSID, WIFI_PWD, debug=True)
    except Exception as e:
        log_err(f"WiFi Fail: {e}")
        time.sleep(5)
        return # Ou reboot

    clientMQTT = connect_mqtt()
    last_pub = 0
    
    while True:
        try:
            if clientMQTT: clientMQTT.check_msg()
            
            now = time.ticks_ms()
            if time.ticks_diff(now, last_pub) > 500:
                last_pub = now
                if clientMQTT:
                    clientMQTT.publish(TOPIC_CAP_CAP, str(read_heading()))
                    clientMQTT.publish(TOPIC_CAP_POT, str(read_pot()))
        except:
             try: clientMQTT = connect_mqtt()
             except: pass
             time.sleep(1)

if __name__ == "__main__":
    main()
