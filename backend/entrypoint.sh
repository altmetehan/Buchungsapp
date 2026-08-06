#!/bin/sh
npx prisma db push
node prisma/seed.js
node src/server.js