from mqtt import MQTTClientSimple
from settings import * # Importe les constantes WIFI et MQTT que vous aurez mis dans un fichier settings.py ou autre
from machine import *
import network
import time
import ujson
import logging
import socket

# NOTE: Pour ce script, vous devez créer un fichier `settings.py` (ou adapter directement ci-dessous)
# avec WIFI_SSID, WIFI_PWD, SERVER_BROKER, PORT_BROKER, NOM_BATEAU
# Par defaut j'utilise des constantes placeholders si non trouvées

try:
    from settings import WIFI_SSID, WIFI_PWD, SERVER_BROKER, PORT_BROKER, NOM_BATEAU
except ImportError:
    # Valeurs par defaut si settings.py absent (A MODIFIER IMPERATIVEMENT)
    WIFI_SSID = "icam_iot"
    WIFI_PWD = "Summ3#C@mp2022"
    SERVER_BROKER = "mqtt.dev.icam.school"
    PORT_BROKER = 1883
    NOM_BATEAU = "monBateau01" # Idem que celui saisi dans l'App Web

# --- Configuration Logging ---
LOG_LEVEL = logging.INFO
# Simuler logging basic si le module logging complet n'est pas dispo
def log_info(msg): print(f"[INFO] {msg}")
def log_err(msg): print(f"[ERROR] {msg}")

# --- Topics MQTT ---
TOPIC_BASE = f"bzh/iot/boat/{NOM_BATEAU}"
TOPIC_CMD_SAFRAN = f"{TOPIC_BASE}/cmd/safran"
TOPIC_CMD_VOILE = f"{TOPIC_BASE}/cmd/voile"
TOPIC_CMD_LCD = f"{TOPIC_BASE}/cmd/lcd"

TOPIC_CAP = f"{TOPIC_BASE}/cap"
TOPIC_POT = f"{TOPIC_BASE}/potentiometer"
TOPIC_STATUS = f"{TOPIC_BASE}/status"

# --- Hardware Setup (PINS A ADAPTER) ---

# 1. Servo Safran (PWM) - Pin 16
safran_pwm = PWM(Pin(16))
safran_pwm.freq(50) 
# Fonction Map Servo (-90..90 deg -> duty_u16)
# Standard Servo: 1ms (0deg) à 2ms (180deg) sur 20ms (50Hz)
# Duty 16bit: 0..65535.  
# 1ms = 1/20 * 65535 = 3276
# 2ms = 2/20 * 65535 = 6553
# Centre 1.5ms = 4915
def set_safran_angle(angle):
    # Angle recu: -90 (gauche) a 90 (droite). Servo attend 0..180.
    # Centre (0) -> 90 servo.
    servo_angle = angle + 90 
    # Clamp 0..180
    servo_angle = max(0, min(180, servo_angle))
    
    # Map 0..180 -> 1ms..2ms (approx 3000..6500)
    # Formule simple: duty = min_duty + (angle/180) * (max_duty-min_duty)
    duty = 3000 + (servo_angle / 180) * (6500 - 3000)
    safran_pwm.duty_u16(int(duty))
    log_info(f"Safran: {angle} deg -> PWM {int(duty)}")

# 2. Stepper Voile (A4988 ou ULN2003) - Pins 17,18,19,20 ou Dir/Step
# Ici exemple simple Stepper générique non-bloquant difficile en boucle simple loop.
# On va simplifier: on suppose un moteur DC avec encoder ou juste un servo treuil pour la voile?
# La demande parlait de "moteur pas a pas".
# Pour simplifier l'exemple, on va piloter de maniere *virtuelle* ou via un contrôleur intelligent.
# Si ULN2003 (28BYJ-48): Il faut séquencer les bobines.
# Le code ci-dessous est un PLACEHOLDER qui log l'action, car piloter un stepper en parallèlle de MQTT sans thread ou asyncio est complexe.
# On simule un servo treuil (souvent utilisé en modélisme voile) pour simplifier le code physique ici :
voile_pwm = PWM(Pin(17)) 
voile_pwm.freq(50)
def set_voile_value(val):
    # Val: 0 (Laché/Slack) .. 100 (Bordé/Taut)
    # Mapper sur servo treuil
    duty = 3000 + (val / 100) * (6500 - 3000)
    voile_pwm.duty_u16(int(duty))
    log_info(f"Voile: {val}%")


# 3. Ecran LCD I2C (Grown/Generic 1602) - I2C0 sur Pins 0(SDA), 1(SCL)
try:
    from machine import I2C
    from lcd_api import LcdApi # A ajouter sur pico
    from i2c_lcd import I2cLcd # A ajouter sur pico
    i2c = I2C(0, sda=Pin(0), scl=Pin(1), freq=400000)
    # Adresse souvent 0x27 ou 0x3F. Scan auto?
    lcd = I2cLcd(i2c, 0x27, 2, 16) # 2 lignes, 16 chars
    lcd.putstr("Boat Ready")
except Exception as e:
    log_err(f"LCD Init fail (libs manquantes?): {e}")
    lcd = None

def update_lcd(text):
    if not lcd: return
    lcd.clear()
    
    # Split text auto 16 chars
    # Si le texte contient \n on respecte, sinon on coupe
    lines = text.split('\n')
    if len(lines) == 1 and len(text) > 16:
        # Auto split
        lines = [text[:16], text[16:32]]
    
    # Affichage Ligne 1
    if len(lines) > 0:
        lcd.move_to(0,0)
        lcd.putstr(lines[0][:16])
        
    # Affichage Ligne 2
    if len(lines) > 1:
        lcd.move_to(0,1)
        lcd.putstr(lines[1][:16])
    
    log_info(f"LCD: {text}")


# 4. Compas (HMC5883L ou QMC5883L) - I2C0
# Simulation lecture (Remplacer par driver reel)
def read_heading():
    # Simule un cap qui change doucement pour test
    # Lire registre I2C reel ici
    import random
    return random.randint(0, 359)

# 5. Potentiometre - ADC Pin 26
pot = ADC(26)
def read_pot():
    raw = pot.read_u16() # 0..65535
    # Map to 0..100
    return int(raw * 100 / 65535)



# --- MQTT Logic ---
clientMQTT = None

def on_message_callback(topic, msg):
    try:
        topic_str = topic.decode()
        msg_str = msg.decode()
        log_info(f"RX {topic_str}: {msg_str}")
        
        if topic_str == TOPIC_CMD_SAFRAN:
            angle = int(msg_str)
            set_safran_angle(angle)
            
        elif topic_str == TOPIC_CMD_VOILE:
            val = int(msg_str)
            set_voile_value(val)
            
        elif topic_str == TOPIC_CMD_LCD:
            update_lcd(msg_str)
            
    except Exception as e:
        log_err(f"Callback Err: {e}")

def connect_mqtt():
    global clientMQTT
    try:
        log_info(f"Connecting Broker {SERVER_BROKER}...")
        client = MQTTClientSimple(
            client_id=f"pico_{NOM_BATEAU}",
            server=SERVER_BROKER,
            port=PORT_BROKER
        )
        client.set_callback(on_message_callback)
        client.connect()
        
        # Subs
        client.subscribe(TOPIC_CMD_SAFRAN)
        client.subscribe(TOPIC_CMD_VOILE)
        client.subscribe(TOPIC_CMD_LCD)
        
        log_info("MQTT Connected & Subscribed")
        return client
    except Exception as e:
        log_err(f"MQTT Connect Fail: {e}")
        return None

# --- Main Loop ---
def main():
    global clientMQTT
    
    # WiFi Connect
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(WIFI_SSID, WIFI_PWD)
    while not wlan.isconnected():
        time.sleep(1)
        print("WiFi...")
    print(f"WiFi OK: {wlan.ifconfig()}")
    
    # MQTT Connect
    clientMQTT = connect_mqtt()
    
    last_pub = 0
    
    while True:
        try:
            # Check Msg
            if clientMQTT:
                clientMQTT.check_msg()
            
            # Publie Capteurs toutes les 500ms
            now = time.ticks_ms()
            if time.ticks_diff(now, last_pub) > 500:
                last_pub = now
                
                # Lire et Publier Cap
                h = read_heading()
                if clientMQTT: 
                    clientMQTT.publish(TOPIC_CAP, str(h))
                
                # Lire et Publier Pot
                p = read_pot()
                if clientMQTT:
                    clientMQTT.publish(TOPIC_POT, str(p))
                    
                # Heartbeat
                # if clientMQTT: clientMQTT.publish(TOPIC_STATUS, "Online")

        except Exception as e:
            log_err(f"Loop Err: {e}")
            time.sleep(1)
            # Reconnexion sommaire
            if clientMQTT is None: 
                 clientMQTT = connect_mqtt()

if __name__ == "__main__":
    main()
