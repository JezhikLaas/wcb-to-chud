export function info (key: string, data = {}) {
    if (game?.i18n) {
        const text = game.i18n.format(key, data);
        if (text) {
            ui?.notifications?.info(text);
        }
    }
}

export function warn (key: string, data = {}) {
    if (game?.i18n) {
        const text = game.i18n.format(key, data);
        if (text) {
            ui?.notifications?.warn(text);
        }
    }
}

export function error (key: string, data = {}) {
    if (game?.i18n) {
        const text = game.i18n.format(key, data);
        if (text) {
            ui?.notifications?.error(text);
        }
    }
}
