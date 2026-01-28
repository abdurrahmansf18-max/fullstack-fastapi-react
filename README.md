# 📚 Docs Platform API & Admin Panel

Bu proje, FastAPI tabanlı bir dokümantasyon yönetim sistemi ve React ile geliştirilmiş modern bir admin paneli içerir. Hem backend hem frontend Docker ve Postgres ile kolayca çalıştırılabilir.

---

## Proje Klasör Yapısı

```
backend/
  main.py
  requirements.txt
  DDL.sql
  uploads/
  app/
  venv/
frontend/
  src/
    admin/
    user/
    shared/
  index.html
  package.json
```

---

## Özellikler

- **Admin Panel:** Kategoriler, başlıklar, içerikler ve admin kullanıcıları yönetimi
- **Markdown Destekli İçerik:** Zengin metin ve resim ekleme
- **Güvenli Giriş:** Sadece yetkili adminler erişebilir
- **Swagger API:** Tüm endpointler için dokümantasyon
- **Docker ile Postgres:** Kolay veritabanı kurulumu

---

## Ekran Görüntüleri



### 1. Swagger API Dokümantasyonu
![Swagger API 1](screenshots/0.png)
![Swagger API 2](screenshots/1.png)

### 2. Docker Postgres Kurulumu
![Docker Postgres](screenshots/2.png)

### 3. Admin Panel Giriş Ekranı
- Açık Tema:
![Admin Login Light](screenshots/3.png)
- Koyu Tema:
![Admin Login Dark](screenshots/4.png)
- Hatalı Giriş:
![Admin Login Error](screenshots/5.png)
- Başarılı Giriş:
![Admin Login Success](screenshots/6.png)

### 4. Kategori Yönetimi
![Kategori Yönetimi](screenshots/7.png)

### 5. Başlık Yönetimi
![Başlık Yönetimi](screenshots/8.png)

### 6. İçerik Ekleme & Resim Yükleme
- Markdown ve resim ekleme:
![İçerik Ekleme Light](screenshots/9.png)
- Resim yükleme ve önizleme:
![İçerik Ekleme Dark](screenshots/10.png)
- Dosya seçme:
![Dosya Seçme](screenshots/11.png)
- Başarılı içerik ekleme:
![İçerik Başarılı](screenshots/12.png)

### 7. Kullanıcı Paneli & İçerik Görüntüleme
![Kullanıcı Paneli](screenshots/13.png)

---

## Kurulum

1. **Backend için:**
   ```bash
   cd backend
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```
2. **Frontend için:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. **Postgres için:**
   Docker Desktop ile `postgres` container başlatın.

---

## Kullanım
- Admin paneline erişmek için `/admin` adresini kullanın.
- API dokümantasyonu için `/docs` adresini ziyaret edin.
- İçerik eklerken Markdown ve resim yükleme desteği vardır.

---

## Katkı
Pull request ve issue açabilirsiniz.

---

## Lisans
MIT
