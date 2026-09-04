# 🚀 OmniFlow - Setup Local

Guía para configurar OmniFlow en tu máquina local con Docker.

## ✅ Requisitos Previos

- Docker instalado ([Descargar](https://www.docker.com/products/docker-desktop))
- Docker Compose instalado (incluido en Docker Desktop)
- Node.js 18+ y pnpm instalados
- Git

## 📋 Pasos de Instalación

### 1. Clona o abre el proyecto
```bash
cd /ruta/a/omniflow
```

### 2. Inicia los servicios Docker (PostgreSQL + Redis)
```bash
docker-compose up -d
```

Verifica que estén corriendo:
```bash
docker-compose ps
```

Deberías ver:
```
NAME                   STATUS
postgres_omniflow      Up (healthy)
redis_omniflow         Up (healthy)
```

### 3. Instala las dependencias
```bash
pnpm install
```

### 4. Ejecuta las migraciones de Prisma
```bash
pnpm db:migrate
```

Este comando crea todas las tablas en PostgreSQL.

### 5. Compila el proyecto
```bash
pnpm build
```

---

## 🎯 Inicia la Aplicación

Abre **3 terminales** diferentes:

### Terminal 1: Frontend (Next.js)
```bash
cd apps/web
pnpm dev
```
Accede a: **http://localhost:3000/login**

### Terminal 2: Backend API (NestJS)
```bash
cd apps/api
pnpm dev
```
El API corre en: **http://localhost:3001**

### Terminal 3: Worker (Background Jobs)
```bash
cd apps/worker
pnpm dev
```

---

## 👤 Crear un Usuario de Prueba

Una vez que todo esté corriendo:

1. Ve a http://localhost:3000/login
2. Haz clic en "Solicita una demostración"
3. Completa el formulario:
   - **Nombre del negocio:** Mi Negocio
   - **Email:** admin@example.com
   - **Contraseña:** Test123456!

4. ¡Listo! Ahora puedes iniciar sesión con esas credenciales

---

## 🗄️ Ver la Base de Datos

Para inspeccionar y editar datos en Prisma Studio:
```bash
pnpm db:studio
```

Se abre un navegador con la interfaz de administración.

---

## 🛑 Detener los Servicios

```bash
docker-compose down
```

Para eliminar volúmenes y datos:
```bash
docker-compose down -v
```

---

## 🆘 Problemas Comunes

### "El registro no funciona"
- Verifica que el API esté corriendo en Terminal 2
- Revisa que PostgreSQL esté saludable: `docker-compose ps`
- Reinicia los servicios: `docker-compose restart`

### "Puerto 5432 ya está en uso"
```bash
# Detén el contenedor anterior
docker stop postgres_omniflow
docker rm postgres_omniflow
docker-compose up -d
```

### "Port 3000 already in use"
- Verifica qué está usando ese puerto
- O usa un puerto diferente: `PORT=3001 pnpm dev`

### "Migrations failed"
```bash
# Reinicia la base de datos
docker-compose down -v
docker-compose up -d
sleep 10
pnpm db:migrate
```

---

## 📝 Variables de Entorno

El archivo `.env` ya está configurado. Si necesitas cambiar algo:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/omniflow_dev"

# Redis
REDIS_URL="redis://localhost:6379"

# API
PORT=3001
NODE_ENV="development"

# JWT
JWT_ACCESS_SECRET="dev-jwt-access-secret-change-in-production-please-12345"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
```

---

## 🧪 Comandos Útiles

```bash
# Ver logs de un servicio
docker-compose logs postgres
docker-compose logs redis

# Acceder a la terminal de PostgreSQL
docker exec -it postgres_omniflow psql -U postgres -d omniflow_dev

# Ver el estado de la aplicación
pnpm build && pnpm test
```

---

## 🎉 ¡Listo!

Tu instancia local de OmniFlow está lista. Ahora puedes:
- ✅ Registrar nuevos usuarios
- ✅ Acceder al dashboard
- ✅ Gestionar sucursales
- ✅ Desarrollar nuevas características

¡Feliz desarrollo! 🚀
