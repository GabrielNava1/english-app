# app.py
# Este es nuestro mini-servidor en Python.
# Su único trabajo: recibir una palabra en inglés y devolver un audio con su pronunciación.

from flask import Flask, request, send_file
from flask_cors import CORS
import edge_tts
import asyncio
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()  # carga las variables del archivo .env

app = Flask(__name__)
CORS(app)  # permite que React (otro puerto) le hable a este servidor

cliente_gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Carpeta donde vamos a guardar los audios generados
CARPETA_AUDIOS = "audios"
if not os.path.exists(CARPETA_AUDIOS):
    os.makedirs(CARPETA_AUDIOS)


async def generar_audio(texto, ruta_salida, voz="en-US-AriaNeural"):
    """Genera un archivo de audio a partir de un texto, en la voz indicada."""
    comunicador = edge_tts.Communicate(texto, voz)
    await comunicador.save(ruta_salida)


def limpiar_texto_para_voz(texto):
    """Quita simbolos de Markdown que suenan raro al leerse en voz alta."""
    texto = texto.replace('**', '')
    texto = texto.replace('"', '')
    texto = texto.replace("'", '')
    return texto.strip()

@app.route("/pronunciar", methods=["POST"])
def pronunciar():
    datos = request.get_json()
    palabra = datos.get("palabra", "")

    if not palabra:
        return {"error": "Falta la palabra"}, 400

    # nombre de archivo seguro, basado en la palabra
    nombre_archivo = f"{palabra.lower().replace(' ', '_')}.mp3"
    ruta = os.path.join(CARPETA_AUDIOS, nombre_archivo)

    # si no existe el audio todavía, lo generamos
    if not os.path.exists(ruta):
        asyncio.run(generar_audio(palabra, ruta))

    return send_file(ruta, mimetype="audio/mpeg")

import uuid

@app.route("/hablar", methods=["POST"])
def hablar():
    datos = request.get_json()
    texto = datos.get("texto", "")

    if not texto:
        return {"error": "Falta el texto"}, 400

    # separamos la respuesta en inglés de la corrección en español, si existe
    if "Corrección:" in texto:
        parte_ingles, parte_espanol = texto.split("Corrección:", 1)
        parte_espanol = "Corrección: " + parte_espanol
    else:
        parte_ingles = texto
        parte_espanol = ""

    parte_ingles = limpiar_texto_para_voz(parte_ingles)
    parte_espanol = limpiar_texto_para_voz(parte_espanol)

    id_unico = uuid.uuid4().hex
    ruta_ingles = os.path.join(CARPETA_AUDIOS, f"temp_{id_unico}_en.mp3")
    ruta_espanol = os.path.join(CARPETA_AUDIOS, f"temp_{id_unico}_es.mp3")
    ruta_final = os.path.join(CARPETA_AUDIOS, f"temp_{id_unico}_final.mp3")

    partes_generadas = []

    if parte_ingles:
        asyncio.run(generar_audio(parte_ingles, ruta_ingles, voz="en-US-AriaNeural"))
        partes_generadas.append(ruta_ingles)

    if parte_espanol:
        asyncio.run(generar_audio(parte_espanol, ruta_espanol, voz="es-MX-DaliaNeural"))
        partes_generadas.append(ruta_espanol)

    # unimos los audios generados en un solo archivo final
    with open(ruta_final, "wb") as archivo_final:
        for parte in partes_generadas:
            with open(parte, "rb") as f:
                archivo_final.write(f.read())

    respuesta = send_file(ruta_final, mimetype="audio/mpeg")

    @respuesta.call_on_close
    def limpiar():
        for ruta in partes_generadas + [ruta_final]:
            if os.path.exists(ruta):
                os.remove(ruta)

    return respuesta
@app.route("/conversar", methods=["POST"])
def conversar():
    datos = request.get_json()
    mensaje_usuario = datos.get("mensaje", "")

    if not mensaje_usuario:
        return {"error": "Falta el mensaje"}, 400

    instrucciones = (
        "Eres un profesor de inglés paciente y amigable. "
        "El usuario está practicando inglés y puede escribir en español o inglés. "
        "Responde SIEMPRE en inglés simple (nivel principiante-intermedio), "
        "y si el usuario cometió un error gramatical, corrígelo amablemente "
        "al final de tu respuesta, en español, con el formato: "
        "'Corrección: ...'. Si no hay errores, no agregues nada de corrección."
    )

    respuesta = cliente_gemini.models.generate_content(
        model="gemini-flash-latest",
        contents=f"{instrucciones}\n\nMensaje del usuario: {mensaje_usuario}",
    )

    return {"respuesta": respuesta.text}


if __name__ == "__main__":
    app.run(port=5000, debug=True)