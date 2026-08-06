#!/bin/sh
npx prisma db push
npx prisma db seed
node src/server.js