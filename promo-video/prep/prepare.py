"""One-time asset prep for the promo video (needs Pillow).
Creates promo-video/prep/out/: logo-white.png, camp-clean.jpg, mattress-clean.jpg
"""
import os
from PIL import Image, ImageFilter, ImageDraw, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, '..', 'assets')
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)

# 1) Logo: cut the clean logo from the mattress studio shot, turn ink into alpha.
src = Image.open(os.path.join(A, '07_mattress.webp')).convert('RGB').crop((375, 100, 880, 270))
src = src.resize((src.width * 3, src.height * 3), Image.LANCZOS)
L = src.convert('L')
bg = 212  # beige background luminance
alpha = L.point(lambda v: max(0, min(255, int((175 - v) * 255 / (175 - 40)))))
# "Peax" is gray in the original → keep it a warm sand tone, the rest white
gray = L.point(lambda v: 255 if 70 < v < 150 else 0).filter(ImageFilter.MaxFilter(3))
white = Image.new('RGB', src.size, (255, 255, 255))
sand = Image.new('RGB', src.size, (214, 200, 176))
rgb = Image.composite(sand, white, gray)
logo = rgb.copy(); logo.putalpha(alpha)
logo = logo.crop(logo.getbbox())
logo.save(os.path.join(OUT, 'logo-white.png'))

# 2) Sunset camp: paint the baked-in logo out with neighbouring sky.
camp = Image.open(os.path.join(A, '01_opening_camp.webp')).convert('RGB')
box = (30, 5, 500, 215)
w, h = box[2] - box[0], box[3] - box[1]
patch = camp.crop((box[0] + 520, box[1], box[2] + 520, box[3])).filter(ImageFilter.GaussianBlur(2))
# colour-match the borrowed sky: per-channel gain from the target's sky pixels (logo ink excluded)
from PIL import ImageStat
target = camp.crop(box)
sky = target.convert('L').point(lambda v: 255 if v > 150 else 0)
tm, pm = ImageStat.Stat(target, sky).mean, ImageStat.Stat(patch).mean
patch = Image.merge('RGB', [c.point(lambda v, g=t / p: min(255, int(v * g))) for c, t, p in zip(patch.split(), tm, pm)])
mask = Image.new('L', (w, h), 0)
ImageDraw.Draw(mask).rounded_rectangle((25, -60, w - 25, h - 25), 30, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(18))
camp.paste(patch, box[:2], mask)
camp.save(os.path.join(OUT, 'camp-clean.jpg'), quality=95)

# 3) Mattress: remove the logo (flat beige backdrop) and keep the product.
m = Image.open(os.path.join(A, '07_mattress.webp')).convert('RGB')
fill = m.crop((60, 40, 300, 280)).resize((1, 1), Image.BOX).getpixel((0, 0))
mask = Image.new('L', m.size, 0)
ImageDraw.Draw(mask).rounded_rectangle((360, 90, 900, 285), 40, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(14))
m = Image.composite(Image.new('RGB', m.size, fill), m, mask)
m.save(os.path.join(OUT, 'mattress-clean.jpg'), quality=95)
print('beige', fill)
