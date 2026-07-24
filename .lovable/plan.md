## Contexto

`src/routes/lovable/email/auth/webhook.ts` ya contiene el `from` correcto:

```
from: `Hayas Client Portal <noreply@${FROM_DOMAIN}>`
```

El email recibido a las 9:08 aún muestra solo `noreply@notify.hayasmarketing.com` como remitente porque el cambio del turno anterior (junto con la edición de `magic-link.tsx`) se guardó en el repo pero **no llegó a publicarse** — producción sigue sirviendo la ruta con el display name antiguo (`Hayas Client Hub`).

## Acción

1. Publicar la app para desplegar `webhook.ts` con el nuevo `from`.
2. Pedir un nuevo código OTP y confirmar en Gmail que la cabecera "de:" muestra `Hayas Client Portal <noreply@notify.hayasmarketing.com>` (nombre visible + dirección).

## Sin cambios de código

No hay que tocar `webhook.ts` ni las plantillas: el valor ya es correcto. Si tras publicar el display name siguiera sin aparecer, sería un problema del envío gestionado (no del código) y lo diagnosticaríamos entonces con `email_domain--list_email_logs`.
