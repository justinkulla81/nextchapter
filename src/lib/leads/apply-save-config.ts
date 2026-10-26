// Off until the owner turns it on: with APPLY_SAVE_EMAIL unset the lead is stored and nothing is sent.
export const applySaveEmailOn = () => process.env.APPLY_SAVE_EMAIL === '1'
