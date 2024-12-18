// Dependencias
const express = require("express");
const { Pool } = require("pg");
const format = require("pg-format");
const app = express();
const port = 3000;

// Config PostgreSQL
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "joyas",
  password: "",
  port: 5432,
});

// Middleware
app.use((request, response, next) => {
  console.log(`Ruta consultada: ${request.method} ${request.path}`);
  next();
});

// Función para manejar errores
const handleErrors = (fn) => async (request, response, nextfn) => {
  try {
    await fn(request, response, nextfn);
  } catch (error) {
    console.error(error);
    response
      .status(500)
      .json({ error: "Ocurrió un error interno del servidor" });
  }
};

// HATEOAS
const prepararHATEOAS = (joyas) => {
  const results = joyas.map((j) => ({
    id: j.id,
    nombre: j.nombre,
    categoria: j.categoria,
    metal: j.metal,
    precio: j.precio,
    href: `/joyas/${j.id}`,
  }));
  return { total: joyas.length, results };
};

// Joyas con paginacion
const obtenerJoyas = async ({ limits = 10, order_by = "id_ASC", page = 1 }) => {
  const [campo, direccion] = order_by.split("_");
  const offset = (page - 1) * limits; //para saltarse las filas.

  const query = format(
    "SELECT * FROM inventario ORDER BY %I %s LIMIT %L OFFSET %L",
    campo,
    direccion.toUpperCase(),
    limits,
    offset
  );

  const { rows } = await pool.query(query);
  return rows;
};

//Mensaje inicial
app.get("/", (req, res) => {
  res.send(`
      <h1>Prueba con las siguientes consultas</h1>
      <p>....</p>
      <ul>
        <li><a href="/joyas?limits=3&page=2&order_by=stock_ASC">localhost:3000/joyas?limits=3&page=2&order_by=stock_ASC</a></li>
        <li><a href="/joyas/filtros?precio_min=25000&precio_max=30000&categoria=aros&metal=plata">http://localhost:3000/joyas/filtros?precio_min=25000&precio_max=30000&categoria=aros&metal=plata</a></li>
      </ul>
    `);
});

// GET/joyas
app.get(
  "/joyas",
  handleErrors(async (req, res) => {
    const joyas = await obtenerJoyas(req.query);
    res.json(prepararHATEOAS(joyas));
  })
);

// joyas + filtros
const obtenerJoyasPorFiltros = async ({
  precio_max,
  precio_min,
  categoria,
  metal,
}) => {
  let filtros = []; //almacena condiciones de filtro, sql
  const values = [];

  const agregarFiltro = (campo, comparador, valor) => {
    values.push(valor);
    filtros.push(`${campo} ${comparador} $${values.length}`);
  };
  //crear las condiciones de filtro y valores sql
  if (precio_max) agregarFiltro("precio", "<=", precio_max);
  if (precio_min) agregarFiltro("precio", ">=", precio_min);
  if (categoria) agregarFiltro("categoria", "=", categoria);
  if (metal) agregarFiltro("metal", "=", metal);
  //construir consulta sql
  const query = `SELECT * FROM inventario ${
    filtros.length ? `WHERE ${filtros.join(" AND ")}` : ""
  }`;
  const { rows } = await pool.query(query, values);
  return rows;
};

// Ruta GET /joyas/filtros
app.get(
  "/joyas/filtros",
  handleErrors(async (req, res) => {
    const joyas = await obtenerJoyasPorFiltros(req.query);
    res.json(prepararHATEOAS(joyas));
  })
);

// Manejo de rutas no encontradas
app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
