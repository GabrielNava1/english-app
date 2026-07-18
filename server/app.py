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


async def generar_audio(texto, ruta_salida):
    """Genera un archivo de audio a partir de un texto en inglés."""
    voz = "en-US-AriaNeural"  # voz en inglés, suena natural
    comunicador = edge_tts.Communicate(texto, voz)
    await comunicador.save(ruta_salida)


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