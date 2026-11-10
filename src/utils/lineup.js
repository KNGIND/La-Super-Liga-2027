export function formationRows(formation, players) {
    const counts = formation.split('-').map(Number);
    if (!counts.length || counts.some((n) => !n || n < 1) || players.length !== counts.reduce((a, b) => a + b, 0) + 1)
        return null;
    const rows = [[players[0]]];
    let i = 1;
    for (const c of counts) {
        rows.push(players.slice(i, i + c));
        i += c;
    }
    return rows; // [arquero, defensa, …, ataque]
}
