// Fonction pour exclure les regroupements
export function isRegionOrGlobal(name) {
    const regionKeywords = ["Europe", "World", "America", "Africa", "Asia", "FAO", "countries", "Countries"];
    return regionKeywords.some(keyword => name.includes(keyword));
}

export function getLastCountryAdded(filters) {
    return filters['country']?.length ? filters['country'][filters['country'].length - 1] : null;
}

// Récupérer la viande sélectionnée
export function getSelectedMeat(filters) {
    return filters['meat']?.length ? filters['meat'] : null;
}