// One-off: 'bullhorn-engage-1r0l' (wave 1) is the same event as 'bullhorn-engage' under another host. Unpublish the newer row; nothing is deleted.
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
p.conferenceEvent.update({ where: { id: 'bullhorn-engage-1r0l' }, data: { published: false, adminNote: 'Duplicate of bullhorn-engage (same event, other host). Unpublished 2026-11-02; merge or delete from the CRM.' } }).then((r) => console.log(r.id, r.published)).finally(() => p.$disconnect())
