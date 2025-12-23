from machine import Pin, PWM, ADC, Timer
import time
from fasapico import *

# --- Configuration Logging ---
enable_logging_types(LOG_DEBUG)

# --- Configuration du Projet ---
NOM_BATEAU = "monBateau"
WIFI_SSID = "icam_iot"
WIFI_PWD = "Summ3#C@mp2022"
SERVER_BROKER = "mqtt.dev.icam.school"
PORT_BROKER = 1883

# --- Topics MQTT ---
TOPIC_BASE = f"bzh/iot/boat/{NOM_BATEAU}"
TOPIC_ACT_SAFRAN = f"{TOPIC_BASE}/actionneurs/safran"
TOPIC_ACT_VOILE = f"{TOPIC_BASE}/actionneurs/voile"
TOPIC_ACT_LCD = f"{TOPIC_BASE}/actionneurs/lcd"
TOPIC_CAP = f"{TOPIC_BASE}/capteurs/cap"
TOPIC_POT = f"{TOPIC_BASE}/capteurs/potentiometer"
TOPIC_STATUS = f"{TOPIC_BASE}/status"

# Variable globale pour le client MQTT
client_mqtt = None

# --- Configuration Materielle ---

# Servo Safran (Pin 7)
safran_pwm = PWM(Pin(7))
safran_pwm.freq(50)

def set_servo_angle(pwm_obj, angle):
    servo_angle = angle + 90
    servo_angle = max(0, min(180, servo_angle))
    duty = int(3000 + (servo_angle / 180) * (6500 - 3000))
    pwm_obj.duty_u16(duty)

# Moteur Pas-a-pas Voile
voile = Stepper()
position_voile = 0

# LCD I2C
lcd = None
try:
    lcd = Grove_LCD_I2C()
    lcd.write("Pret")
except Exception as e:
    error(f"Init LCD: {e}")

def update_lcd(text):
    if not lcd: return
    lcd.clear()
    lines = text.split('\n')
    if len(lines) == 1 and len(text) > 16:
        lines = [text[:16], text[16:32]]
    if len(lines) > 0:
        lcd.cursor_position(0, 0)
        lcd.write(lines[0][:16])
    if len(lines) > 1:
        lcd.cursor_position(0, 1)
        lcd.write(lines[1][:16])

# Boussole (capteur magnétique BMM150)
boussole = None
try:
    boussole = Boussole(sdaPin=0, sclPin=1)
    info("Boussole initialisee OK")
except Exception as e:
    error(f"Init Boussole: {e}")

def lire_cap():
    """Retourne le cap de la boussole en degrés (0-360)"""
    if not boussole:
        return None
    try:
        return int(boussole.get_compass_degree())
    except Exception as e:
        error(f"Lecture boussole: {e}")
        return None

# Potentiometre
pot = ADC(27)

def read_pot():
    raw = pot.read_u16()
    return scale_to_int(raw, 0, 65535, 100, 0)

# --- Callback MQTT ---
def on_message_callback(topic, msg):
    try:
        topic_str = decode_bytes(topic)
        msg_str = decode_bytes(msg)
        info(f"RX {topic_str}: {msg_str}")
        
        if topic_str.endswith("/safran"):
            set_servo_angle(safran_pwm, int(float(msg_str)))
        elif topic_str.endswith("/voile"):
            deplacer_voile(msg_str)
        elif topic_str.endswith("/lcd"):
            update_lcd(msg_str)
            
    except Exception as e:
        error(f"Callback: {e}")

def deplacer_voile(cible):
    global position_voile
    try:
        cible = int(float(cible))
        delta = cible - position_voile
        info(f"Voile: {delta} pas (-> {cible})")
        voile.move(delta)
        position_voile = cible
    except Exception as e:
        error(f"Deplacement Voile: {e}")

# --- Fonctions Timer ---
def publish_sensors(timer):
    if not client_mqtt: return
    try:
        cap = lire_cap()
        if cap is not None:
            client_mqtt.publish(TOPIC_CAP, str(cap))
        client_mqtt.publish(TOPIC_POT, str(read_pot()))
    except Exception as e:
        error(f"Publication: {e}")

def publier_statut(timer):
    if not client_mqtt: return
    try:
        client_mqtt.publish(TOPIC_STATUS, "Online")
    except Exception as e:
        error(f"Statut: {e}")

def network_check(timer):
    if not client_mqtt: return
    try:
        client_mqtt.check_connection()
    except Exception as e:
        error(f"Network: {e}")

# --- Init Client MQTT ---
# On utilise un wildcard pour s'abonner à tous les actionneurs
TOPIC_ACTIONNEURS = f"{TOPIC_BASE}/actionneurs/#"

client_mqtt = ClientMQTT(
    broker=SERVER_BROKER,
    port=PORT_BROKER,
    client_id=f"pico_{NOM_BATEAU}",
    topic_cmd=TOPIC_ACTIONNEURS,
    callback=on_message_callback
)

# --- Demarrage ---
info("--- Demarrage Bateau IoT ---")
network_check(None)

# --- Timers (apres init client) ---
Timer(mode=Timer.PERIODIC, period=1000, callback=publish_sensors)
Timer(mode=Timer.PERIODIC, period=5000, callback=publier_statut)
Timer(mode=Timer.PERIODIC, period=10000, callback=network_check)

# --- Boucle Principale ---
while True:
    try:
        client_mqtt.check_msg()
    except Exception as e:
        error(f"Main Loop: {e}")
        time.sleep(1)

