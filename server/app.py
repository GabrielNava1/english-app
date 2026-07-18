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
from supabase import create_client
import json

load_dotenv()  # carga las variables del archivo .env

app = Flask(__name__)
CORS(app)  # permite que React (otro puerto) le hable a este servidor

cliente_gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
cliente_supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

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

    instrucciones = """
Eres un profesor de inglés paciente y amigable. El usuario está practicando
inglés y puede escribir en español o inglés. Responde SIEMPRE en inglés
simple (nivel principiante-intermedio).

Debes responder ÚNICAMENTE con un JSON válido, sin texto adicional, sin
marcado de código, con esta estructura exacta:

{
  "respuesta": "tu respuesta conversacional en inglés",
  "tiene_error": true o false,
  "tema_error": "gramatica" o "vocabulario" o "pronunciacion" o null,
  "texto_incorrecto": "lo que el usuario escribió mal, o null",
  "texto_correcto": "la version correcta, o null",
  "explicacion": "explicacion breve en español del error, o null",
  "palabra_clave": "la palabra o regla clave del error en ingles, ej 'went', o null"
}

Si no hay ningún error, deja tiene_error en false y los demás campos en null.
"""

    respuesta = cliente_gemini.models.generate_content(
        model="gemini-flash-latest",
        contents=f"{instrucciones}\n\nMensaje del usuario: {mensaje_usuario}",
    )

    texto_crudo = respuesta.text.strip()
    # a veces Gemini envuelve el JSON en ```json ... ``` — lo limpiamos
    if texto_crudo.startswith("```"):
        texto_crudo = texto_crudo.split("```")[1]
        if texto_crudo.startswith("json"):
            texto_crudo = texto_crudo[4:]
        texto_crudo = texto_crudo.strip()

    try:
        datos_ia = json.loads(texto_crudo)
    except json.JSONDecodeError:
        return {"respuesta": respuesta.text, "tiene_error": False}

    # si detectamos un error, lo guardamos y reforzamos vocabulario
    if datos_ia.get("tiene_error"):
        guardar_error_y_reforzar(datos_ia)

    return {"respuesta": datos_ia.get("respuesta", "")}


def guardar_error_y_reforzar(datos_ia):
    tema = datos_ia.get("tema_error")
    palabra_clave = datos_ia.get("palabra_clave")

    try:
        # 1. Registrar el error (o incrementar contador si ya existe uno igual)
        existente = (
            cliente_supabase.table("errores_detectados")
            .select("id, veces_detectado")
            .eq("palabra_clave", palabra_clave)
            .execute()
        )

        if existente.data:
            id_existente = existente.data[0]["id"]
            veces = existente.data[0]["veces_detectado"] + 1
            cliente_supabase.table("errores_detectados").update(
                {"veces_detectado": veces}
            ).eq("id", id_existente).execute()
        else:
            cliente_supabase.table("errores_detectados").insert(
                {
                    "tema": tema,
                    "texto_incorrecto": datos_ia.get("texto_incorrecto"),
                    "texto_correcto": datos_ia.get("texto_correcto"),
                    "explicacion": datos_ia.get("explicacion"),
                    "palabra_clave": palabra_clave,
                }
            ).execute()

        # 2. Si es de vocabulario, reforzar en la tabla vocabulario (acercar su repaso)
        if tema == "vocabulario" and palabra_clave:
            palabra_existente = (
                cliente_supabase.table("vocabulario")
                .select("id")
                .ilike("palabra_en", palabra_clave)
                .execute()
            )
            if palabra_existente.data:
                id_palabra = palabra_existente.data[0]["id"]
                cliente_supabase.table("vocabulario").update(
                    {"proximo_repaso": "2000-01-01", "intervalo_dias": 1}
                ).eq("id", id_palabra).execute()

    except Exception as e:
        print(f"Error guardando error detectado: {e}")

if __name__ == "__main__":
    app.run(port=5000, debug=True)