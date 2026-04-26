import { Hono } from 'hono'

import { handleMailListQuery } from '../common'
import { resolveRawEmailRow } from '../gzip'
import i18n from '../i18n'

const api = new Hono<HonoCustomType>()

api.get('/open_api/quick_mails', async (c) => {
    const { address, limit, offset } = c.req.query();
    const msgs = i18n.getMessagesbyContext(c);
    if (!address) {
        return c.text("Address is required", 400);
    }

    // Auto-create address if not exists (so future emails won't be rejected)
    try {
        const existing = await c.env.DB.prepare(
            `SELECT id FROM address WHERE name = ?`
        ).bind(address).first("id");
        if (!existing) {
            await c.env.DB.prepare(
                `INSERT INTO address(name) VALUES(?)`
            ).bind(address).run();
        }
    } catch (e) {
        // Ignore duplicate insert errors
        console.warn("auto-create address:", e);
    }

    return await handleMailListQuery(c,
        `SELECT * FROM raw_mails WHERE address = ?`,
        `SELECT count(*) as count FROM raw_mails WHERE address = ?`,
        [address], limit || "20", offset || "0"
    );
})

api.get('/open_api/quick_mail/:mail_id', async (c) => {
    const { address } = c.req.query();
    const { mail_id } = c.req.param();
    if (!address) {
        return c.text("Address is required", 400);
    }
    const result = await c.env.DB.prepare(
        `SELECT * FROM raw_mails WHERE id = ? AND address = ?`
    ).bind(mail_id, address).first();
    if (!result) return c.json(null);
    return c.json(await resolveRawEmailRow(result));
})

export { api }
