/**
 * catalogo-inicial.js — Demostración de joyería.
 * Carga, solo la primera vez y solo si no hay productos, un catálogo de
 * ejemplo con fotos y ~2 semanas de ventas para que los reportes no se vean
 * vacíos. Precios y costos son de referencia: se editan desde Productos.
 */

const CATALOGO_INICIAL = [
  { nombre: 'Anillo solitario oro 18k', categoria: 'Anillos', precio: 3200, costo: 2100, foto: 'anillo-solitario', peso: 5 },
  { nombre: 'Argollas de matrimonio (par)', categoria: 'Anillos', precio: 2800, costo: 1900, foto: 'argollas-matrimonio', peso: 2 },
  { nombre: 'Anillo plata con esmeralda', categoria: 'Anillos', precio: 650, costo: 380, foto: 'anillo-esmeralda', peso: 6 },
  { nombre: 'Cadena de oro eslabón 20"', categoria: 'Cadenas y collares', precio: 4200, costo: 3000, foto: 'cadena-oro', peso: 1 },
  { nombre: 'Collar plata con corazón', categoria: 'Cadenas y collares', precio: 380, costo: 190, foto: 'collar-corazon', peso: 9 },
  { nombre: 'Dije de cruz en oro', categoria: 'Dijes', precio: 950, costo: 600, foto: 'dije-cruz', peso: 4 },
  { nombre: 'Aretes de perla', categoria: 'Aretes', precio: 420, costo: 230, foto: 'aretes-perla', peso: 10 },
  { nombre: 'Aretes de argolla oro', categoria: 'Aretes', precio: 780, costo: 480, foto: 'aretes-argolla', peso: 7 },
  { nombre: 'Pulsera de plata eslabón', categoria: 'Pulseras', precio: 520, costo: 300, foto: 'pulsera-plata', peso: 8 },
  { nombre: 'Pulsera tenis circonias', categoria: 'Pulseras', precio: 890, costo: 500, foto: 'pulsera-tenis', peso: 5 },
  { nombre: 'Reloj dorado para dama', categoria: 'Relojes', precio: 1250, costo: 800, foto: 'reloj-dorado', peso: 4 },
  { nombre: 'Juego collar y aretes rubí', categoria: 'Juegos', precio: 1480, costo: 900, foto: 'juego-collar-aretes', peso: 3 },
];

const CatalogoInicial = {
  async asegurar() {
    try {
      const ajustes = (await DB.obtenerPorId(DB.STORES.AJUSTES, 1)) || { id: 1 };
      if (ajustes.catalogoInicialCargado) return;
      const existentes = await DB.contar(DB.STORES.PRODUCTOS);
      if (existentes > 0) return;

      const ruta = location.pathname.includes('/pages/') ? '../img/productos/' : './img/productos/';
      const productos = [];
      for (const item of CATALOGO_INICIAL) {
        const producto = {
          nombre: item.nombre,
          categoria: item.categoria,
          precio: item.precio,
          costo: item.costo,
          tipoVenta: 'unidad',
          activo: true,
          creadoEn: Date.now(),
        };
        try {
          const resp = await fetch(`${ruta}${item.foto}.jpg`);
          if (resp.ok) producto.imagenBlob = await resp.blob();
        } catch (err) {
          // Sin foto: el producto se crea igual.
        }
        producto.id = await DB.agregar(DB.STORES.PRODUCTOS, producto);
        productos.push({ ...producto, peso: item.peso });
      }

      await this.cargarVentasDemo(productos);

      // La marca se guarda al final: si algo falla se reintenta en la próxima apertura.
      ajustes.catalogoInicialCargado = true;
      await DB.actualizar(DB.STORES.AJUSTES, ajustes);
    } catch (err) {
      // Si falla, la app arranca con lo que haya.
    }
  },

  // 14 días de ventas con la caja cerrada de cada día (hoy queda libre para
  // que quien prueba abra su propia caja).
  async cargarVentasDemo(productos) {
    if ((await DB.contar(DB.STORES.VENTAS)) > 0) return;
    const usuarios = await DB.obtenerTodos(DB.STORES.USUARIOS);
    const admin = usuarios[0];
    if (!admin) return;

    let semilla = 20240607;
    const azar = () => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296; };
    const bolsa = [];
    productos.forEach((p) => { for (let i = 0; i < p.peso; i++) bolsa.push(p); });
    const metodos = ['efectivo', 'efectivo', 'tarjeta', 'deposito', 'tarjeta'];
    let recibo = 1;

    for (let dia = 14; dia >= 1; dia--) {
      const base = new Date();
      base.setDate(base.getDate() - dia);
      base.setHours(9, 0, 0, 0);
      const ventasDia = 2 + Math.floor(azar() * 4); // 2 a 5 ventas
      const cajaId = await DB.agregar(DB.STORES.CAJAS, {
        usuarioId: admin.id,
        fechaApertura: base.getTime(),
        montoInicial: 500,
        fechaCierre: base.getTime() + 9 * 3600 * 1000,
        montoContado: 500,
        diferencia: 0,
        cerrada: true,
      });
      let efectivoDia = 0;
      for (let v = 0; v < ventasDia; v++) {
        const lineas = [];
        const n = azar() < 0.25 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const p = bolsa[Math.floor(azar() * bolsa.length)];
          if (!lineas.find((l) => l.p.id === p.id)) lineas.push({ p, cantidad: 1 });
        }
        const total = lineas.reduce((a, l) => a + l.p.precio * l.cantidad, 0);
        const ganancia = lineas.reduce((a, l) => a + (l.p.precio - l.p.costo) * l.cantidad, 0);
        const metodo = metodos[Math.floor(azar() * metodos.length)];
        if (metodo === 'efectivo') efectivoDia += total;
        const fecha = base.getTime() + (1 + v * 2 + Math.floor(azar() * 2)) * 3600 * 1000;
        const ventaId = await DB.agregar(DB.STORES.VENTAS, {
          numeroRecibo: recibo++,
          fecha,
          usuarioId: admin.id,
          metodoPago: metodo,
          total,
          ganancia,
          cajaId,
          ...(metodo === 'tarjeta' || metodo === 'deposito' ? { bancoId: null, bancoNombre: '' } : {}),
          esDomicilio: false,
          esPedidosYa: false,
          tipoEntrega: 'local',
          costoEnvio: 0,
          clienteId: null,
          clienteNombre: '',
          clienteTelefono: '',
          clienteDireccion: '',
          telefonoAlterno: '',
          notasEntrega: '',
        });
        for (const l of lineas) {
          await DB.agregar(DB.STORES.DETALLE_VENTA, {
            ventaId,
            productoId: l.p.id,
            nombreProducto: l.p.nombre,
            precioUnitario: l.p.precio,
            costoUnitario: l.p.costo,
            cantidad: l.cantidad,
            esPeso: false,
            extra: 0,
            nota: '',
            subtotal: l.p.precio * l.cantidad,
            ganancia: (l.p.precio - l.p.costo) * l.cantidad,
          });
        }
      }
      // El conteo de cierre cuadra con lo vendido en efectivo.
      const caja = await DB.obtenerPorId(DB.STORES.CAJAS, cajaId);
      caja.montoContado = 500 + efectivoDia;
      await DB.actualizar(DB.STORES.CAJAS, caja);
    }
  },
};

window.CatalogoInicial = CatalogoInicial;
