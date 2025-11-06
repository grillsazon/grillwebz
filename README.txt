# Grill & Sazón — Public Build
Este paquete está listo para GitHub Pages. La primera vez que un visitante entre,
el sitio importará automáticamente `data/seed.json` a su navegador para que todos
vean el mismo menú base.

Para actualizar el menú global sin tocar código:
1) Ve a `admin.html`, crea o edita tu menú.
2) Pulsa **Exportar** y guarda el archivo `.json` de respaldo.
3) En el repositorio, reemplaza `data/seed.json` con ese archivo.
4) (Opcional) Si no ves cambios, borra el almacenamiento del navegador o cambia
   la versión del flag dentro de `seed-public.js` (variable FLAG).
