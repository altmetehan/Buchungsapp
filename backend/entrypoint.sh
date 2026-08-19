#!/bin/sh
npx prisma db push
node src/server.js