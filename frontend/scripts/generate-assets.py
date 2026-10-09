#!/usr/bin/env python3
"""Genera assets placeholder para Expo/EAS Build.
Reemplaza estos archivos por los diseños finales de marca antes del lanzamiento."""
import os
import struct
import wave
from PIL import Image, ImageDraw, ImageFont

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets")
THEME_ORANGE = (243, 120, 32)
WHITE = (255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)


def save_png(img: Image.Image, name: str):
    path = os.path.join(ASSETS_DIR, name)
    img.save(path, "PNG")
    print(f"Generado: {path}")


def draw_logo(draw: ImageDraw.Draw, size: int, color: tuple):
    # Dibuja un rectángulo redondeado como fondo de logo
    pad = size // 8
    draw.rounded_rectangle(
        [pad, pad, size - pad, size - pad],
        radius=size // 10,
        fill=color,
    )
    # Intenta poner texto "PJ"; si no hay fuente, solo queda el rectángulo
    try:
        font_size = size // 3
        font = ImageFont.truetype("arial.ttf", font_size)
        bbox = draw.textbbox((0, 0), "PJ", font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        x = (size - text_w) // 2
        y = (size - text_h) // 2 - text_h // 6
        draw.text((x, y), "PJ", font=font, fill=WHITE)
    except Exception:
        pass


def generate_icon():
    size = 1024
    img = Image.new("RGB", (size, size), THEME_ORANGE)
    draw = ImageDraw.Draw(img)
    draw_logo(draw, size, (30, 30, 30))
    save_png(img, "icon.png")


def generate_adaptive_icon():
    size = 1024
    img = Image.new("RGB", (size, size), THEME_ORANGE)
    draw = ImageDraw.Draw(img)
    draw_logo(draw, size, (30, 30, 30))
    save_png(img, "adaptive-icon.png")


def generate_splash():
    width, height = 1242, 2436
    img = Image.new("RGB", (width, height), THEME_ORANGE)
    draw = ImageDraw.Draw(img)
    logo_size = min(width, height) // 3
    # Dibujar logo centrado
    pad_x = (width - logo_size) // 2
    pad_y = (height - logo_size) // 2
    temp = Image.new("RGB", (logo_size, logo_size), THEME_ORANGE)
    temp_draw = ImageDraw.Draw(temp)
    draw_logo(temp_draw, logo_size, (30, 30, 30))
    img.paste(temp, (pad_x, pad_y))
    save_png(img, "splash.png")


def generate_favicon():
    size = 32
    img = Image.new("RGB", (size, size), THEME_ORANGE)
    draw = ImageDraw.Draw(img)
    draw_logo(draw, size, (30, 30, 30))
    save_png(img, "favicon.png")


def generate_notification_icon():
    size = 96
    img = Image.new("RGBA", (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(img)
    # Icono blanco simple: rectángulo redondeado
    pad = size // 8
    draw.rounded_rectangle(
        [pad, pad, size - pad, size - pad],
        radius=size // 10,
        fill=WHITE,
    )
    save_png(img, "notification-icon.png")


def generate_notification_sound():
    path = os.path.join(ASSETS_DIR, "notification-sound.wav")
    # Generar 0.1s de silencio mono 16-bit a 44100 Hz
    duration = 0.1
    sample_rate = 44100
    num_samples = int(duration * sample_rate)
    with wave.open(path, "w") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        for _ in range(num_samples):
            wav.writeframes(struct.pack("<h", 0))
    print(f"Generado: {path}")


if __name__ == "__main__":
    os.makedirs(ASSETS_DIR, exist_ok=True)
    generate_icon()
    generate_adaptive_icon()
    generate_splash()
    generate_favicon()
    generate_notification_icon()
    generate_notification_sound()
    print("\nAssets placeholder listos. Reemplázalos por los oficiales de marca antes de publicar.")
