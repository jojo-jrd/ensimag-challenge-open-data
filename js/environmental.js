const COLOR_PRODUCTION_EMISSION = "#dc05ca",
    COLOR_CONSUMPTION_EMISSION = "#0abb07";

document.addEventListener("DOMContentLoaded", () => {
    let dataConsumption, dataProduction, dataEmission, mode = "PRODUCTIONEMISSION", year = 1961, color = COLOR_PRODUCTION_EMISSION;
    // Dimensions des graphique
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    async function loadData() {
        // Chargement des données
        dataConsumption = await d3.csv("./../csv/consumption.csv", d => ({
            location : d["LOCATION"],
            type_meat : d["SUBJECT"].toLowerCase(),
            measure : d["MEASURE"], //.replace(/(_CAP|THND_TONNE)/g, ""),
            year : +d["TIME"],
            value : +d["Value"],
        }));

        dataProduction = await d3.csv("./../csv/production.csv", d => ({
            country : d["Country"],
            code : d["Code"],
            year : +d["Year"],
            value : +d["Meat, total | 00001765 || Production | 005510 || tonnes"],
        }));

        dataEmission = await d3.csv("./../csv/meat-emissions.csv", d => ({
            product : d["Food product"],
            // TODO other columns
        }));
    }

    function updateData() {
        // Supprime tous les graphiques précédents
        const allChart = document.querySelectorAll(".section svg");
        for (let chart of allChart) {
            chart.remove();
        }
        // TODO: gestion mode + date + noData

        // Gère les données et la couleur en fonction du mode
        if (mode == "PRODUCTIONEMISSION") {
            currentData = dataProduction;
            color = COLOR_PRODUCTION_EMISSION;
        } else {
            currentData = dataConsumption;
            color = COLOR_CONSUMPTION_EMISSION;
        }

        // Mets à jour tous les graphiques
        // TODO charts
        // TODO faire un produit avec currentData et dataEmission

        
    }

    function initListeners() {
        const dateInput = document.getElementById('dateInput');
        const selectedYearElem = document.getElementById('selectedYear');
        // Initialise avec la valeur courante
        dateInput.value = year;
        dateInput.addEventListener("input", function() {
            // Change l'année
            year = parseInt(this.value);
            selectedYearElem.textContent = year;
            // Recharge les données
            updateData();
        });

        // AJoute des listeners sur les boutons
        for (let m of ['consumptionEmission', 'productionEmission']) {
            document.getElementById(`${m}Button`).addEventListener('click', () => {
                mode = m.toUpperCase();
                // Recharge les données
                updateData();
            })
        }
    }

    async function initPage() {
        await loadData();
        initListeners();
        updateData();
    }

    initPage();
});