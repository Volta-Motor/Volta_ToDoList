# Zitadel ile giriş (OpenID Connect)

TO DO List, Zitadel gibi OpenID Connect sağlayıcılarıyla giriş yapabilir. Akış: yetkilendirme kodu + PKCE. İstemci gizli anahtarı isteğe bağlıdır.

## 1. Zitadel tarafı

1. Bir proje açın (ya da var olanı kullanın) ve içine **Web** tipinde bir uygulama ekleyin.
2. Kimlik doğrulama yöntemi olarak **PKCE** seçin. Gizli anahtar kullanmak isterseniz **Basic** seçin; uygulama gizli anahtarı HTTP Basic ile gönderir, **Post** yöntemi desteklenmez.
3. Yönlendirme adresi (Redirect URI): `https://<uygulama-adresi>/auth/oidc/callback/`
4. İstemci kimliğini (Client ID) not edin.

Kullanıcıların e-posta adresi Zitadel'de **doğrulanmış** olmalıdır. Doğrulanmamış e-postayla giriş reddedilir, çünkü hesaplar e-posta üzerinden eşleştirilir.

## 2. TO DO List tarafı

Yönetim panelinde (`/god-mode`) **Authentication → OpenID Connect → Configure**:

| Alan          | Değer                                                     |
| ------------- | --------------------------------------------------------- |
| Provider name | Giriş düğmesinde görünen ad, örneğin `Zitadel`            |
| Issuer URL    | Zitadel adresiniz, örneğin `https://giris.sirketiniz.com` |
| Client ID     | Zitadel'deki istemci kimliği                              |
| Client secret | PKCE kullanıyorsanız boş bırakın                          |

Kaydettikten sonra sayfanın üstündeki anahtarla girişi etkinleştirin. Giriş ekranında "Continue with Zitadel" düğmesi görünür.

Aynı ayarlar API servisine ortam değişkeni olarak da verilebilir: `IS_OIDC_ENABLED`, `OIDC_PROVIDER_NAME`, `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `ENABLE_OIDC_SYNC`. Ortam değişkenleri yalnızca ilk kurulumda okunur; sonrasında yönetim panelindeki değer geçerlidir. Gizli anahtarı depoya yazmayın.

## Nasıl çalışır

- Uç noktalar `<Issuer URL>/.well-known/openid-configuration` adresinden okunur ve bir saat önbellekte tutulur.
- Kullanıcı bilgisi `userinfo` uç noktasından alınır: `sub`, `email`, `email_verified`, `given_name`, `family_name`, `picture`.
- İlk girişte kullanıcı hesabı kendiliğinden oluşur. Yeni kayıtlar kapalıysa (`ENABLE_SIGNUP=0`) yalnızca davet edilmiş e-postalar girebilir.
- "Sync" anahtarı açıksa ad ve profil resmi her girişte Zitadel'den güncellenir.

## Sınırlar

- Çıkış yalnızca TO DO List oturumunu kapatır; Zitadel oturumu açık kalır.
- Zitadel rolleri uygulamaya taşınmaz; yetkiler uygulama içinden verilir.
- Herkese açık "space" sayfalarında bu giriş yoktur; yalnızca ana uygulamada vardır.
