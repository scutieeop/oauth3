# Discord Auth2Bot - Bot Bileşeni

Bu klasör, Discord Auth2Bot projesinin bot bileşenini içerir. Bu bileşen, Discord sunucularında çalışacak ve kullanıcıları yedekleyip başka sunuculara ekleme işlemlerini gerçekleştirecektir.

## Kurulum

1. `.env.example` dosyasını `.env` olarak kopyalayın ve gerekli bilgileri doldurun
2. Bağımlılıkları yükleyin:
   ```
   npm install
   ```
3. Botu başlatın:
   ```
   npm start
   ```

## Bot Komutları

### /yedekle
OAuth2 ile yetkilendirilmiş tüm kullanıcıları yedekler.

### /yedeklerilistele
Tüm mevcut yedekleri ayrıntılı bir şekilde listeler.

### /kullaniciekle
Bir yedekten kullanıcıları mevcut sunucuya ekler.

## Önemli Not

Bu bot, Vercel üzerinde çalışmaz. Bir VPS, Dedicated veya Cloud sunucu üzerinde çalıştırılmalıdır. Web arayüzü Vercel üzerinde çalışırken, bu bot bileşeni ayrı bir sunucuda çalışacak şekilde tasarlanmıştır.

## Veritabanı Gereksinimleri

Bot, kullanıcı tokenları ve yedekleri saklamak için MongoDB veritabanına ihtiyaç duyar. Aynı veritabanı, web arayüzü tarafından da kullanılmalıdır, böylece web arayüzündeki OAuth2 işlemleri sırasında saklanan tokenlar, bot tarafından kullanılabilir. 