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
import re

load_dotenv()  # carga las variables del archivo .env

app = Flask(__name__)
CORS(app)  # permite que React (otro puerto) le hable a este servidor

cliente_gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

LIMITE_DIARIO_ESTIMADO = 1000  # aproximado para gemini-flash-lite-latest, puede variar

def llamar_gemini(prompt):
    """Llama a Gemini y lleva registro de cuantas llamadas se hacen hoy."""
    respuesta = cliente_gemini.models.generate_content(
        model="gemini-flash-lite-latest",
        contents=prompt,
    )
    registrar_uso()
    return respuesta


def registrar_uso():
    try:
        hoy = str(__import__("datetime").date.today())
        existente = cliente_supabase.table("uso_api").select("*").eq("fecha", hoy).execute()
        if existente.data:
            nuevas = existente.data[0]["llamadas"] + 1
            cliente_supabase.table("uso_api").update({"llamadas": nuevas}).eq("fecha", hoy).execute()
        else:
            cliente_supabase.table("uso_api").insert({"fecha": hoy, "llamadas": 1}).execute()
    except Exception as e:
        print(f"Error registrando uso: {e}")

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

    respuesta = llamar_gemini(f"{instrucciones}\n\nMensaje del usuario: {mensaje_usuario}")

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
    tiene_error = datos_ia.get("tiene_error", False)
    if tiene_error:
        guardar_error_y_reforzar(datos_ia)

    actualizar_stats_conversacion(tiene_error)

    return {"respuesta": datos_ia.get("respuesta", "")}


def actualizar_stats_conversacion(tiene_error):
    try:
        actual = (
            cliente_supabase.table("conversacion_stats")
            .select("*")
            .eq("id", 1)
            .execute()
        )
        if actual.data:
            fila = actual.data[0]
            nuevos_datos = {
                "mensajes_totales": fila["mensajes_totales"] + 1,
                "mensajes_con_error": fila["mensajes_con_error"] + (1 if tiene_error else 0),
            }
            cliente_supabase.table("conversacion_stats").update(nuevos_datos).eq("id", 1).execute()
    except Exception as e:
        print(f"Error actualizando stats de conversacion: {e}")


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

@app.route("/generar-repaso", methods=["POST"])
def generar_repaso():
    datos = request.get_json()
    tema = datos.get("tema", "")  # 'gramatica' o 'pronunciacion'

    if tema not in ("gramatica", "pronunciacion"):
        return {"error": "Tema invalido"}, 400

    # buscamos hasta 5 errores de este tema que no se hayan usado todavia
    errores = (
        cliente_supabase.table("errores_detectados")
        .select("*")
        .eq("tema", tema)
        .eq("usado", False)
        .order("veces_detectado", desc=True)
        .limit(5)
        .execute()
    )

    if not errores.data:
        return {"mensaje": "No hay errores nuevos pendientes de repasar", "generadas": 0}

    generadas = 0

    for error in errores.data:
        pregunta_generada = generar_pregunta_desde_error(error, tema)

        if pregunta_generada:
            if tema == "gramatica":
                cliente_supabase.table("gramatica").insert(pregunta_generada).execute()
            else:
                cliente_supabase.table("pronunciacion").insert(pregunta_generada).execute()

            cliente_supabase.table("errores_detectados").update(
                {"usado": True}
            ).eq("id", error["id"]).execute()

            generadas += 1

    return {"mensaje": "Preguntas generadas con exito", "generadas": generadas}


def generar_pregunta_desde_error(error, tema):
    if tema == "gramatica":
        instrucciones = f"""
Un estudiante de ingles cometio este error real:
Escribio: "{error['texto_incorrecto']}"
Lo correcto era: "{error['texto_correcto']}"
Explicacion: {error['explicacion']}

Crea UNA pregunta de opcion multiple en ingles para practicar exactamente esta
regla gramatical, distinta a la oracion original pero sobre el mismo error.

Responde UNICAMENTE con un JSON valido, sin texto adicional, con esta estructura:
{{
  "pregunta": "una oracion en ingles con un espacio en blanco ___",
  "opcion_a": "...",
  "opcion_b": "...",
  "opcion_c": "...",
  "respuesta_correcta": "la opcion correcta, debe ser identica a una de las 3 opciones",
  "explicacion": "explicacion breve en español"
}}
"""
    else:  # pronunciacion
        instrucciones = f"""
Un estudiante de ingles confundio esta palabra: "{error['palabra_clave']}"
Contexto del error: escribio "{error['texto_incorrecto']}" en vez de "{error['texto_correcto']}"

Crea una entrada de practica de pronunciacion para esa palabra en ingles.

Responde UNICAMENTE con un JSON valido, sin texto adicional, con esta estructura:
{{
  "palabra_es": "la palabra en español",
  "palabra_en": "la palabra en ingles, debe ser '{error['palabra_clave']}'",
  "pronunciacion": "como suena la palabra en letras faciles de leer en español, ej 'pipol'"
}}
"""

    try:
        respuesta = llamar_gemini(instrucciones)
        texto_crudo = respuesta.text.strip()
        if texto_crudo.startswith("```"):
            texto_crudo = texto_crudo.split("```")[1]
            if texto_crudo.startswith("json"):
                texto_crudo = texto_crudo[4:]
            texto_crudo = texto_crudo.strip()

        return json.loads(texto_crudo)
    except Exception as e:
        print(f"Error generando pregunta: {e}")
        return None        

@app.route("/generar-lectura", methods=["POST"])
def generar_lectura():
    datos = request.get_json()
    nivel = datos.get("nivel", "A1")

    instrucciones = f"""
Escribe un texto corto en inglés (60-100 palabras) para un estudiante de nivel
{nivel} del Marco Común Europeo (MCERL). Debe ser interesante, con vocabulario
y gramática apropiados para ese nivel exacto (ni más fácil ni más difícil).
Puede ser una mini-historia, un dato curioso, o una anécdota breve.

Responde UNICAMENTE con un JSON valido, sin texto adicional, con esta estructura:
{{
  "titulo": "un titulo corto en ingles",
  "contenido": "el texto completo en ingles"
}}
"""

    try:
        respuesta = llamar_gemini(instrucciones)
        texto_crudo = respuesta.text.strip()
        if texto_crudo.startswith("```"):
            texto_crudo = texto_crudo.split("```")[1]
            if texto_crudo.startswith("json"):
                texto_crudo = texto_crudo[4:]
            texto_crudo = texto_crudo.strip()

        datos_lectura = json.loads(texto_crudo)

        resultado = (
            cliente_supabase.table("lecturas")
            .insert(
                {
                    "titulo": datos_lectura["titulo"],
                    "contenido": datos_lectura["contenido"],
                    "nivel": nivel,
                }
            )
            .execute()
        )

        return {"lectura": resultado.data[0]}
    except Exception as e:
        print(f"Error generando lectura: {e}")
        return {"error": str(e)}, 500


@app.route("/uso-api", methods=["GET"])
def uso_api():
    from datetime import date
    hoy = str(date.today())
    resultado = cliente_supabase.table("uso_api").select("*").eq("fecha", hoy).execute()
    llamadas_hoy = resultado.data[0]["llamadas"] if resultado.data else 0

    return {
        "llamadas_hoy": llamadas_hoy,
        "limite_estimado": LIMITE_DIARIO_ESTIMADO,
        "porcentaje": round((llamadas_hoy / LIMITE_DIARIO_ESTIMADO) * 100),
    }


if __name__ == "__main__":
    app.run(port=5000, debug=True)