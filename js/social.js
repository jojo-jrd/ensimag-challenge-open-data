const COLOR_PRODUCTION = "#e7a30c",
    COLOR_CONSUMPTION = "#ae13bb";

document.addEventListener("DOMContentLoaded", () => {
    let dataConsumption, dataProduction, mode = "PRODUCTION", year = 1961, color = COLOR_PRODUCTION;
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
    }

    function chartMap(data) {
        // TODO
    }

    function chart1(data) {
        const svg = d3.select("#graph1")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`)
 
        // TODO change that

        const dataGrouped = data.reduce((acc, current) => {
            const found = acc.find(item => item.year === current.year);
            if (found) {
            found.value += current.value; // Ajouter la valeur si l'année existe déjà
            } else {
            acc.push({ year: current.year, value: current.value }); // Ajouter une nouvelle entrée si l'année est nouvelle
            }
            return acc;
        }, [])
        
        // Création de l'axe des absisses 
        const x = d3.scalePoint()
            .domain(dataGrouped.map(elem => elem.year))
            .range([0, width]);
        
        // Création de l'axe des ordonnées
        const y = d3.scaleLinear()
            .domain([0, d3.max(dataGrouped, d => d.value)])
            .range([height, 0]);

        // Création et affichage des axes
        svg.append("g")
            .attr("transform", `translate(0, ${height})`)
            .call(d3.axisBottom(x));

        svg.append("g")
            .call(d3.axisLeft(y));

        // Création de la ligne
        svg.append("path")
            .datum(dataGrouped)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 2)
            .attr("d", d3.line()
              .x(d => x(d.year))
              .y(d => y(d.value))
            );

        
        // Création de la légende
        svg.append("text")
            .attr("x", width - 80)
            .attr("y", 20)
            .attr("fill", color)
            .text("TEST");
    }

    function updateData() {
        // Supprime tous les graphiques précédents
        const allChart = document.querySelectorAll("svg");
        for (let chart of allChart) {
            chart.remove();
        }
        // TODO: gestion mode + date + noData

        // Gère les données et la couleur en fonction du mode
        let currentData;
        if (mode == "PRODUCTION") {
            currentData = dataProduction;
            color = COLOR_PRODUCTION;
        } else {
            currentData = dataConsumption;
            color = COLOR_CONSUMPTION;
        }
        // Mets à jour tous les graphiques
        chartMap(currentData);
        chart1(currentData);
        // TODO other charts

        
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
        for (let m of ['consumption', 'production']) {
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