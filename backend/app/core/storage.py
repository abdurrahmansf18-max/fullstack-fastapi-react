import uuid
from pathlib import Path
from typing import Tuple
from fastapi import UploadFile
from PIL import Image
from app.core.config import settings, ABS_UPLOADS_DIR

def _allowed_mimes() -> set[str]:
    return set(x.strip() for x in settings.ALLOWED_MIME.split(",") if x.strip())

class LocalStorage:
    def __init__(self, base_dir: str | None = None, public_base_url: str | None = None):
        # Mutlak klasörü kullan
        self.base_dir = Path(base_dir or ABS_UPLOADS_DIR)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.public_base_url = (public_base_url or settings.STATIC_BASE_URL).rstrip("/")
        self.allowed = _allowed_mimes()
        self.max_bytes = settings.MAX_UPLOAD_BYTES

    async def save_image(self, file: UploadFile) -> Tuple[str, str]:
        if file.content_type not in self.allowed:
            raise ValueError("Unsupported file type")

        # Boyut limiti (stream ederek)
        size = 0
        chunks: list[bytes] = []
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > self.max_bytes:
                raise ValueError("File too large")
            chunks.append(chunk)

        ext = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
        }.get(file.content_type, "")

        fname = f"{uuid.uuid4().hex}{ext}"
        abs_path = self.base_dir / fname
        with open(abs_path, "wb") as f:
            for ch in chunks:
                f.write(ch)

        # Gerçek görsel mi?
        try:
            with Image.open(abs_path) as im:
                im.verify()
        except Exception:
            abs_path.unlink(missing_ok=True)
            raise ValueError("Invalid image file")

        # Kayıtlara mutlak domain yerine relatif yol yazalım.
        # Böylece dış ortam (ngrok, prod) altında doğru domain ile servis edilir.
        public_url = f"{settings.STATIC_MOUNT_PATH}/{fname}"
        return str(abs_path), public_url
