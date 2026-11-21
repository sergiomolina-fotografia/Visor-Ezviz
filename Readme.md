📺 EZVIZ TV

Tus cámaras en tu TV

Un proyecto experimental para llevar las cámaras de seguridad EZVIZ directamente a los televisores LG webOS, navegadores web y dispositivos Android.

---

💡 La idea

EZVIZ TV nace de una idea sencilla: poder visualizar nuestras cámaras de seguridad EZVIZ directamente desde el televisor, sin depender exclusivamente del teléfono celular.

Queremos desarrollar una aplicación que permita acceder a las cámaras vinculadas a una cuenta EZVIZ, visualizar imágenes en directo y, especialmente, consultar y reproducir las grabaciones almacenadas en las tarjetas microSD de cada cámara.

La intención es aprovechar la pantalla del televisor para convertirlo en un centro de visualización y consulta de nuestras cámaras.

No buscamos reproducir toda la aplicación oficial de EZVIZ. Queremos desarrollar una alternativa sencilla, cómoda y adaptada al control remoto del televisor.

🚧 Estado del proyecto

En desarrollo — Etapa de investigación y pruebas de compatibilidad.

Actualmente estamos realizando pruebas desde el navegador web de un televisor LG con webOS 6.0.

El principal desafío consiste en encontrar un método compatible que permita acceder a las funciones de las cámaras, especialmente a las grabaciones almacenadas en sus tarjetas microSD.

Todavía no hemos conseguido implementar y validar el funcionamiento completo. Por eso, este repositorio documenta un desarrollo experimental y no una aplicación terminada.

Objetivos de investigación actuales

- Investigar los mecanismos oficiales de comunicación y autorización de EZVIZ.
- Identificar las posibilidades de acceso a las cámaras desde un navegador.
- Comprobar la compatibilidad de los protocolos de transmisión con webOS.
- Investigar cómo acceder a las grabaciones de las tarjetas microSD.
- Evaluar las posibilidades de reproducción de grabaciones protegidas mediante los mecanismos oficiales de EZVIZ.
- Encontrar una arquitectura que permita reutilizar la solución en distintas plataformas.

🎯 Objetivos del proyecto

El objetivo es construir una aplicación multiplataforma con una interfaz sencilla y orientada principalmente a televisores.

Funciones que buscamos implementar

1. Acceso y autorización

- Iniciar sesión o autorizar el acceso mediante mecanismos compatibles con EZVIZ.
- Obtener la lista de cámaras asociadas a la cuenta.
- Identificar y seleccionar cada dispositivo.

2. Visualización en directo

- Reproducir el video de las cámaras.
- Seleccionar entre distintas cámaras.
- Visualizar en pantalla completa.
- Adaptar la interfaz al control remoto del televisor.

3. Grabaciones de microSD

- Consultar las grabaciones disponibles.
- Seleccionar una fecha mediante un calendario.
- Visualizar una línea de tiempo con los segmentos grabados.
- Reproducir, pausar y avanzar o retroceder en las grabaciones.

4. Experiencia de usuario

- Interfaz optimizada para televisores.
- Navegación mediante control remoto.
- Compatibilidad con pantallas grandes.
- Diseño sencillo, rápido y funcional.

🖥️ Plataformas previstas

El proyecto contempla tres posibles versiones:

Plataforma| Tecnología prevista
LG Smart TV| Aplicación webOS empaquetada en IPK
Android| Aplicación Android empaquetada en APK
Navegadores web| Aplicación web accesible desde Internet

Las tres versiones buscarán compartir la mayor cantidad posible de código y lógica, siempre que las diferencias técnicas de cada plataforma lo permitan.

📷 Equipos utilizados en las pruebas

Las primeras investigaciones se realizan con cámaras EZVIZ de uso doméstico:

- EZVIZ CS-H3c-R100-1K2WF.
- EZVIZ CS-C3TN-AO-1H2WF.

Televisor de referencia:

- LG 50UP7750PSB.
- Año: 2021.
- Sistema operativo: webOS 6.0.
- Motor de navegador: Chromium 79.
- Resolución: 4K UHD.

Estos equipos constituyen el entorno inicial de pruebas. La compatibilidad con otros modelos deberá verificarse posteriormente.

🔬 Investigación técnica

Una parte fundamental del proyecto consiste en investigar las posibilidades que ofrecen los mecanismos oficiales y las tecnologías compatibles con EZVIZ.

Entre los aspectos que se están estudiando:

- SDK y servicios de desarrollo de EZVIZ.
- Autenticación y autorización de dispositivos.
- Protocolos de transmisión de video.
- Compatibilidad con navegadores basados en Chromium.
- Acceso a grabaciones almacenadas en microSD.
- Reproducción de contenido protegido.
- Posible utilización de un servidor intermediario para adaptar los flujos de video a las plataformas de destino.

No se presupone que todas estas alternativas sean compatibles. Cada una deberá ser investigada y probada antes de incorporarse al proyecto.

🏗️ Organización del repositorio

El repositorio está pensado para reunir el código, las pruebas y la documentación de todas las plataformas:

EZVIZ-TV/
│
├── README.md
│
├── server/
│
├── web/
│
├── webos/
│
├── android/
│
├── shared/
│
├── branding/
│
├── apk-analysis/
│
├── documentation/
│
└── releases/

La estructura podrá modificarse a medida que avance la investigación y se definan las tecnologías definitivas.

🛣️ Hoja de ruta

- [x] Definir el objetivo y alcance del proyecto.
- [x] Identificar los primeros equipos de prueba.
- [x] Comenzar las pruebas desde el navegador del televisor.
- [ ] Investigar los mecanismos de autorización de EZVIZ.
- [ ] Conseguir comunicación funcional con las cámaras.
- [ ] Lograr visualizar video en directo desde webOS.
- [ ] Investigar el acceso a las grabaciones de microSD.
- [ ] Conseguir reproducir grabaciones desde el televisor.
- [ ] Desarrollar una interfaz completa optimizada para TV.
- [ ] Adaptar la solución a Android.
- [ ] Publicar una versión web estable.
- [ ] Preparar versiones instalables y documentación de uso.

🤝 Filosofía del proyecto

EZVIZ TV es un proyecto de experimentación, aprendizaje y desarrollo tecnológico.

La prioridad es investigar, probar, documentar y encontrar soluciones reales a los desafíos de compatibilidad entre las cámaras EZVIZ y las distintas plataformas.

No queremos dar por resuelto aquello que todavía está en pruebas. Cada avance deberá estar respaldado por una prueba funcional.

La idea es construir algo útil, sencillo y accesible, aprovechando tecnologías web y las posibilidades de los televisores inteligentes.

🔐 Seguridad y privacidad

La seguridad de los dispositivos y de las cuentas es una prioridad.

- No publicar contraseñas ni credenciales de EZVIZ.
- No almacenar tokens o claves privadas en repositorios públicos.
- No compartir grabaciones privadas ni datos sensibles.
- Utilizar mecanismos de autorización seguros.
- Respetar las condiciones de uso y licencias de las tecnologías utilizadas.

📌 Una idea, un objetivo

Que puedas sentarte frente a tu televisor, abrir EZVIZ TV, elegir una cámara y ver tanto lo que está sucediendo en ese momento como lo que quedó grabado en su tarjeta microSD.

Ese es el objetivo. Todavía estamos trabajando para conseguirlo.
