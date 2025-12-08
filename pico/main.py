from mqtt import MQTTClientSimple
from fasapico import *
from machine import *
import network
import time
import ujson
import logging
import socket

# --- Configuration Logging ---
logging.enable_logging_types(logging.LOG_DEBUG)

# --- Configuration du Projet (A MODIFIER) ---
NOM_GROUPE = "monBateau"      # <--- METTRE LE NOM DE VOTRE GROUPE ICI
SERVER_BROKER = "mqtt.dev.icam.school"
PORT_BROKER = 1883            # Port standard non-SSL

# --- Topics MQTT ---
TOPIC_BASE = f"bzh/iot/boat/{NOM_GROUPE}"  # Topic spécifique bateau
TOPIC_CMD = f"{TOPIC_BASE}/cmd"
TOPIC_STATUS = f"{TOPIC_BASE}/status"
# On peut ajouter d'autres topics (ex: boussole, gps, batterie...)

# --- Identifiants WiFi ---
WIFI_SSID = "icam_iot"
WIFI_PWD = "Summ3#C@mp2022"

# --- Variables globales ---
clientMQTT = None

# --- Configuration Moteurs (Exemple pour Driver L298N ou Shield I2C) ---
# Vous devez adapter cette partie à votre matériel réel (fichiers Moteur.py etc)
# Ici on simule une classe simple pour piloter 2 moteurs en PWM
class MoteurSimple:
    def __init__(self, pin_pwm, pin_dir1, pin_dir2):
        self.pwm = PWM(Pin(pin_pwm))
        self.pwm.freq(1000)
        self.dir1 = Pin(pin_dir1, Pin.OUT)
        self.dir2 = Pin(pin_dir2, Pin.OUT)
        
    def vitesse(self, val_percent): # -100 à 100
        val_percent = max(-100, min(100, val_percent))
        duty = int(abs(val_percent) * 65535 / 100)
        
        if val_percent > 0:
            self.dir1.value(1)
            self.dir2.value(0)
        elif val_percent < 0:
            self.dir1.value(0)
            self.dir2.value(1)
        else:
            self.dir1.value(0)
            self.dir2.value(0)
            
        self.pwm.duty_u16(duty)

# Exemple de mapping pins (A AJUSTER selon votre câblage)
# Moteur Gauche
moteur_gauche = MoteurSimple(pin_pwm=16, pin_dir1=17, pin_dir2=18)
# Moteur Droit
moteur_droit = MoteurSimple(pin_pwm=19, pin_dir1=20, pin_dir2=21)

def set_motor_speeds(gauche_pct, droite_pct):
    moteur_gauche.vitesse(gauche_pct)
    moteur_droit.vitesse(droite_pct)
    logging.info(f"ACTION MOTEURS: G={gauche_pct:.1f}% D={droite_pct:.1f}%")

# --- Fonctions de Mapping ---
def map_value(x, in_min, in_max, out_min, out_max):
    return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min

def controle_differentiel(gauche_raw, droite_raw):
    # Mapping -65535..65535 (Webapp) -> -100..100 (Pour les moteurs)
    mg = map_value(gauche_raw, -65535, 65535, -100, 100)
    md = map_value(droite_raw, -65535, 65535, -100, 100)
    
    # Sécurité bornes
    mg = max(-100, min(100, mg))
    md = max(-100, min(100, md))
    
    set_motor_speeds(mg, md)

# --- Commandes Simples (Boutons ou Joystick simple) ---
def avancer():
    set_motor_speeds(80, 80)

def reculer():
    set_motor_speeds(-80, -80)

def stop():
    set_motor_speeds(0, 0)
    
def tourner_gauche(): # Rotation sur place
    set_motor_speeds(-60, 60)

def tourner_droite(): # Rotation sur place
    set_motor_speeds(60, -60)


# --- Callback MQTT ---
def on_message_callback(topic, msg):
    try:
        topic_str = topic.decode()
        msg_str = msg.decode()
        
        if topic_str.endswith("/cmd"):
            # 1. Essayer de décoder du JSON (Contrôle Proportionnel/Différentiel)
            if msg_str.strip().startswith("{"):
                try:
                    data = ujson.loads(msg_str)
                    # L'app web envoie souvent 'traingauche' et 'traindroit' ou 'left'/'right'
                    # Adaptez selon ce que votre app enverra.
                    # Basé sur mecaquad:
                    if 'traingauche' in data and 'traindroit' in data:
                        g = float(data['traingauche'])
                        d = float(data['traindroit'])
                        controle_differentiel(g, d)
                    elif 'left' in data and 'right' in data: # Alternative fréquente
                         g = float(data['left'])
                         d = float(data['right'])
                         controle_differentiel(g, d)

                except Exception as e:
                    logging.error(f"Erreur JSON: {e}")
            
            # 2. Commandes Simples (String)
            else:
                cmd = msg_str.strip()
                if cmd == "avancer": avancer()
                elif cmd == "reculer": reculer()
                elif cmd == "stop": stop()
                elif cmd == "gauche": tourner_gauche()
                elif cmd == "droite": tourner_droite()
                else:
                    logging.warning(f"Commande inconnue: {cmd}")
                    
    except Exception as e:
        logging.error(f"Erreur Callback: {e}")


# --- Gestion Réseau (Copie simplifiée de Mecaquad) ---
def connect_to_wifi(ssid, password):
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        logging.info('Connexion WiFi...')
        wlan.connect(ssid, password)
        # Attente basique (mieux vaut utiliser un timeout dans une boucle réelle)
        time.sleep(5) 
    if wlan.isconnected():
        logging.info(f"WiFi Connecté: {wlan.ifconfig()}")
        return True
    return False

def publier_statut(timer):
    global clientMQTT
    if clientMQTT:
        try:
            clientMQTT.publish(TOPIC_STATUS, "Online")
        except:
            pass

def network_check(timer):
    global clientMQTT
    try:
        # Check WiFi et Reconnexion si besoin
        if not connect_to_wifi(WIFI_SSID, WIFI_PWD):
            logging.error("WiFi non connecté.")
            return

        # Check MQTT
        if clientMQTT:
            try:
                clientMQTT.ping()
            except:
                logging.error("MQTT Ping fail.")
                clientMQTT = None

        # Reconnect MQTT
        if clientMQTT is None:
            logging.info(f"Connexion Broker {SERVER_BROKER}...")
            client = MQTTClientSimple(
                client_id=f"pico_boat_{NOM_GROUPE}",
                server=SERVER_BROKER,
                port=PORT_BROKER
            )
            client.set_callback(on_message_callback)
            client.connect()
            client.subscribe(TOPIC_CMD)
            logging.info(f"Abonné à {TOPIC_CMD}")
            clientMQTT = client

    except Exception as e:
        logging.error(f"Erreur Network: {e}")
        clientMQTT = None

# --- Timers ---
Timer(mode=Timer.PERIODIC, period=5000, callback=publier_statut)
Timer(mode=Timer.PERIODIC, period=10000, callback=network_check)

# --- Démarrage ---
logging.info("--- Démarrage Bateau IoT ---")
network_check(None)

# --- Boucle ---
while True:
    try:
        if clientMQTT:
            clientMQTT.check_msg()
        else:
            time.sleep(1)
    except Exception as e:
        logging.error(f"Main Loop Err: {e}")
        time.sleep(1)
