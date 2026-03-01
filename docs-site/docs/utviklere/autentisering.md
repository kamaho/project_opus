---
title: Autentisering
sidebar_position: 2
---

# Autentisering

API-forespørsler må inneholde en gyldig API-nøkkel.

## Header

```
Authorization: Bearer <API_NØKKEL>
```

## Scopes

API-nøkler kan begrenses til visse scopes (f.eks. `clients:read`, `reports:write`). Se innstillinger i Revizo under **Innstillinger → API-nøkler**.

## Rate limiting

Forespørsler er begrenset per nøkkel. Ved overskridelse returneres HTTP 429.

*Detaljer og eksempler kommer ved API-lansering.*
