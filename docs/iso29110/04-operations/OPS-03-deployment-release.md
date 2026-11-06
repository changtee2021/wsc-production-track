# OPS-03 การติดตั้งและรุ่น

| รายการ | ค่า |
| --- | --- |
| Document ID | OPS-03 |
| Document Title | การติดตั้งและรุ่น |
| Project Name | WSC Production Track |
| Version | 0.1 |
| Created Date | 3 พฤศจิกายน 2026 |
| Prepared By | ที่ปรึกษาจัดทำจากซอร์ส |
| Reviewed By | PENDING HUMAN INPUT |
| Approved By | PENDING HUMAN INPUT |
| Document Status | DRAFT |

## Revision History

| Version | Date | Description | Approved By |
| --- | --- | --- | --- |
| 0.1 | 3 พฤศจิกายน 2026 | จากเอกสาร deploy และ vercel.json | PENDING HUMAN INPUT |

## Architecture

ดู SI-02 โฮสต์ที่ไฟล์ตั้งค่าชี้คือ Vercel region `sin1`

## Environment

Node ตาม `docs/DEPLOY-VERCEL.md` ระบุ Node 20 ขึ้นไป คำสั่งติดตั้ง `npm install --legacy-peer-deps` คำสั่ง build `npm run build`

## Procedure ที่เอกสารเดิมเขียนไว้

1. ตั้งตัวแปรตาม `.env.example` บนโฮสต์โดยไม่ใส่ความลับลง Git
2. build ให้จบ
3. ตรวจ `GET /api/public/health`

รอบเขียนเอกสารนี้ไม่ได้สั่ง build และไม่ได้เรียก health ของโฮสต์จริง

## Release identity

ซอร์สที่สำรวจชี้ HEAD `8951f84` working tree ยังมีรายการไม่ commit 17 รายการ จึงยังไม่ใช่รุ่นที่ปิด

## Rollback

เอกสาร go-live บอกให้นำเข้าไฟล์ `wsc_production.sql` จากรอบสำรองถ้าข้อมูลพัง ยังไม่มีเลขไฟล์สำรองที่พิสูจน์ว่ารอบล่าสุดมีไฟล์นั้น

## ข้อมูลที่ต้องขอผู้ดูแล

เลข deployment ปัจจุบัน, วันขึ้นจริง, และว่าตัวแปรบนโฮสต์ครบตามตัวอย่างหรือไม่
