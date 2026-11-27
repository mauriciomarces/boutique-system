# Fuentes y referencias bibliográficas

Referencias consultadas el 13 de noviembre de 2026. Las fuentes normativas se identifican como estándares o publicaciones institucionales; las guías OWASP y RFC se utilizan como referencias técnicas. Se indican versiones cuando son identificables. La inclusión de una fuente no implica certificación o cumplimiento integral del proyecto.

## Referencias en formato APA 7

### OWASP

OWASP Foundation. (2021). *OWASP Top 10:2021*. https://owasp.org/Top10/2021/

OWASP Foundation. (2025). *Application Security Verification Standard (ASVS), version 5.0.0*. https://owasp.org/www-project-application-security-verification-standard/

OWASP Foundation. (s. f.-a). *Authentication Cheat Sheet*. OWASP Cheat Sheet Series. https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

OWASP Foundation. (s. f.-b). *Input Validation Cheat Sheet*. OWASP Cheat Sheet Series. https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html

OWASP Foundation. (s. f.-c). *Logging Cheat Sheet*. OWASP Cheat Sheet Series. https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

OWASP Foundation. (s. f.-d). *Password Storage Cheat Sheet*. OWASP Cheat Sheet Series. https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

OWASP Foundation. (s. f.-e). *REST Security Cheat Sheet*. OWASP Cheat Sheet Series. https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html

OWASP Foundation. (s. f.-f). *Session Management Cheat Sheet*. OWASP Cheat Sheet Series. https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html

OWASP Foundation. (s. f.-g). *SQL Injection Prevention Cheat Sheet*. OWASP Cheat Sheet Series. https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html

OWASP Foundation. (s. f.-h). *Transport Layer Security Cheat Sheet*. OWASP Cheat Sheet Series. https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html

### NIST e IETF

National Institute of Standards and Technology. (2025). *Digital Identity Guidelines: Authentication and Authenticator Management (NIST Special Publication 800-63B-4)*. https://pages.nist.gov/800-63-4/sp800-63b.html

National Institute of Standards and Technology. (2022). *Secure Software Development Framework (SSDF) Version 1.1: Recommendations for Mitigating the Risk of Software Vulnerabilities (NIST Special Publication 800-218)*. https://csrc.nist.gov/pubs/sp/800/218/final

Jones, M., Bradley, J., & Sakimura, N. (2015). *JSON Web Token (JWT) (RFC 7519)*. Internet Engineering Task Force. https://datatracker.ietf.org/doc/html/rfc7519

Sheffer, Y., Hardt, D., & Jones, M. (2020). *JSON Web Token Best Current Practices (RFC 8725)*. Internet Engineering Task Force. https://datatracker.ietf.org/doc/html/rfc8725

### ISO

International Organization for Standardization. (2022a). *ISO/IEC 27001:2022—Information security, cybersecurity and privacy protection: Information security management systems—Requirements*. https://www.iso.org/standard/27001

International Organization for Standardization. (2022b). *ISO/IEC 27002:2022—Information security, cybersecurity and privacy protection: Information security controls*. https://www.iso.org/standard/75652.html

International Organization for Standardization. (2019). *ISO 22301:2019—Security and resilience: Business continuity management systems—Requirements*. https://www.iso.org/standard/75106.html

## Documentación del proyecto consultada

- Boutique System. (s. f.). *README del repositorio*. `README.md`.
- Boutique System. (s. f.). *Boutique System Architecture*. `docs/architecture.md`.
- Boutique System. (s. f.). *Pipeline experimental de análisis de eventos*. `docs/ML_PIPELINE.md`.
- Boutique System. (s. f.). *Auditoría de correcciones, diagramas y redacción*. `Informe_revision_tesis_y_diagramas_mermaid.md`.
- Boutique System. (s. f.). *Guía y prompt de redacción para artículos científicos y proyectos de grado*. Archivo externo recibido para esta tarea.
- Boutique System. (s. f.). Código de autenticación y permisos, eventos, gateway, servicios y pruebas listados en [matriz_auditoria_seguridad.md](./matriz_auditoria_seguridad.md).

## Relación de citas internas

| Etiqueta de cita sugerida | Fuente | Uso en el informe |
|---|---|---|
| (OWASP Foundation, 2021) | OWASP Top 10:2021 | Clasificación A01–A10 |
| (OWASP Foundation, 2025) | ASVS 5.0.0 | Requisitos de verificación y diseño de pruebas |
| (OWASP Foundation, s. f.-a) | Authentication Cheat Sheet | Controles de contraseña, errores y autenticación |
| (OWASP Foundation, s. f.-b) | Input Validation Cheat Sheet | Validación y separación de autorización |
| (OWASP Foundation, s. f.-c) | Logging Cheat Sheet | Trazabilidad y monitoreo |
| (OWASP Foundation, s. f.-d) | Password Storage Cheat Sheet | bcrypt, salt y factor de trabajo |
| (OWASP Foundation, s. f.-e) | REST Security Cheat Sheet | TLS, autorización por endpoint y JWT |
| (OWASP Foundation, s. f.-f) | Session Management Cheat Sheet | Robo y manejo de tokens |
| (OWASP Foundation, s. f.-g) | SQL Injection Prevention Cheat Sheet | ORM y parámetros |
| (OWASP Foundation, s. f.-h) | Transport Layer Security Cheat Sheet | Confidencialidad e integridad de transporte |
| (National Institute of Standards and Technology, 2025) | NIST SP 800-63B-4 | Contraseñas, autenticación y MFA |
| (National Institute of Standards and Technology, 2022) | NIST SP 800-218 | Ciclo de desarrollo seguro |
| (Sheffer et al., 2020; Jones et al., 2015) | RFC 8725 y RFC 7519 | Claims, firma y buenas prácticas JWT |
| (International Organization for Standardization, 2022a) | ISO/IEC 27001:2022 | Gestión de riesgos e ISMS |
| (International Organization for Standardization, 2022b) | ISO/IEC 27002:2022 | Guía de controles de seguridad |
| (International Organization for Standardization, 2019) | ISO 22301:2019 | Continuidad y recuperación |

**Nota de consistencia APA:** los sufijos `a–h` corresponden al orden alfabético de títulos para las obras OWASP sin fecha; deben conservarse de igual manera en las citas del texto. No sustituir “s. f.” por una fecha supuesta.
