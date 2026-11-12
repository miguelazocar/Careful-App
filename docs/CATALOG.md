# Catálogo de vehículos

El alta pide primero **marca y año**. Con eso, la app muestra **los modelos de ese año** y, al elegir uno, **sus versiones de ese año**. Si el auto no figura, «Otro modelo» permite escribir el modelo y la versión a mano. Es el único caso en que se escriben a mano.

## Fuente

Las listas de precios de la **Cámara del Comercio Automotor (CCA)** para autos, pick-ups, todo terreno y utilitarios vendidos en Argentina. Cada edición trae el 0 km y los 14 años anteriores. Se usan cuatro ediciones para cubrir de **1997 a 2026**:

| Edición | Años que cubre | Origen |
|---|---|---|
| Diciembre 2011 | 1997–2011 | Wayback Machine |
| Noviembre 2016 | 2002–2016 | Wayback Machine |
| Agosto 2021 | 2007–2021 | Wayback Machine |
| Noviembre 2026 | 2012–2026 | `cca.org.ar/descargas/precios/Autos.pdf` |

Del PDF se toman **solo los nombres** (marca, modelo, versión) **y los años en que la versión figura con precio**, nunca los precios. Resultado: unas **88 marcas, 1.000 modelos y 11.500 versiones**, en `src/data/catalog/brands/*.json` (unos 500 KB).

Los logos de marca provienen de [Simple Icons](https://simpleicons.org) (CC0). Las marcas sin ícono muestran un monograma.

## Cómo se arma

`scripts/catalog/`:

1. **`cca_parse.py <pdf> <salida.json>`** (requiere `pdfminer.six`): lee cada página con las posiciones y tipografías del texto.
   - Las columnas de años salen del encabezado de la página.
   - Cada precio se asigna a la columna más cercana. Los precios del 0 km están alineados a la derecha y empiezan un poco antes de su título.
   - Clasificación de filas:
     - **Modelo**: fila con otro estilo (negrita o letra más grande).
     - **Marca**: fila sin precios, con espacio extra arriba, seguida de un modelo. Se valida contra la lista de marcas de Mercado Libre.
     - **Versión**: todas las demás filas.
   - Algunas ediciones simulan la negrita imprimiendo el texto dos veces ("TOYOTA TOYOTA"). Eso se deshace.
2. **`build_catalog.js <carpeta con parsed_*.json> <repo>`**: une las ediciones y genera los JSON y `brands/index.ts`.
   - Normaliza nombres: "Mercedes-Benz", "C-HR", quita "PICK - UP".
   - Une las versiones que la CCA etiqueta con el año del restyling ("DRIVE GSE 2020").
   - Une las abreviaturas que las ediciones escriben con y sin barra: "A/T" y "AT", "M/T" y "MT", "7/A" y "7A", "7/P" y "7P". Si no, la misma versión aparecía dos veces.
   - Deduce la carrocería para el ícono.

En la app (`src/data/catalog/index.ts`), el combustible y la caja se deducen del nombre de la versión ("TDI" es diésel, "CVT" es caja CVT, y así).

## Actualizar

```bash
python -m venv .venv && .venv/Scripts/pip install pdfminer.six
curl -o Autos.pdf https://www.cca.org.ar/descargas/precios/Autos.pdf
.venv/Scripts/python scripts/catalog/cca_parse.py Autos.pdf work/parsed_2027.json   # junto a las ediciones anteriores
node scripts/catalog/build_catalog.js work .
npm run check
```

Los `id` de marca y modelo se guardan en los vehículos: el script los deriva del nombre, así que no cambian entre ediciones.
