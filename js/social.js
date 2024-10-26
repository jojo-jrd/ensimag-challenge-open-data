const COLOR_PRODUCTION = "#e7a30c",
    COLOR_CONSUMPTION = "#ae13bb",
    COLOR_PRICE = "#45b707";

document.addEventListener("DOMContentLoaded", () => {
    let dataConsumption, dataProduction, dataPrice, mode = "PRODUCTION", year = 1961, color = COLOR_PRODUCTION;
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

        dataPrice = await d3.csv("./../csv/meat-prices.csv", d => ({
            month : d["Month"],
            beef_price : +d["Beef Price"],
            beef_price_percentage : d["Beef price % Change"] == "NaN" ? NaN : d["Beef price % Change"],
            chicken_price : +d["Chicken Price"],
            chicken_price_percentage : d["Chicken price % Change"] == "NaN" ? NaN : d["Chicken price % Change"],
            lamb_price : +d["Lamb price"],
            lamb_price_percentage : d["Lamb price % Change"] == "NaN" ? NaN : d["Lamb price % Change"],
            pork_price : +d["Pork Price"],
            pork_price_percentage : d["Pork price % Change"] == "NaN" ? NaN : d["Pork price % Change"],
            salmon_price : +d["Salmon Price"],
            salmon_price_percentage : d["Salmon price % Change"] == "NaN" ? NaN : d["Salmon price % Change"]
        }));
    }

    function chartMap(data) {
        // TODO gestion des données en fonction du mode ici (enlever le paramètre data)

        // TODO
    }

    function chart1(data) {
        // TODO gestion des données en fonction du mode ici (enlever le paramètre data)

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

    function chart2(data) {
        // TODO gestion des données en fonction du mode ici (enlever le paramètre data)

        // Création du graphique
        const svg = d3.select("#graph2")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`)

        // Création de l'axe des absisses 
        const x = d3.scalePoint()
            .domain(data.map(d => d.month))
            .range([0, width]);

        // Création de l'axe des ordonnées
        // TODO: change that
        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => Math.max(d.beef_price, d.chicken_price, d.lamb_price, d.pork_price, d.salmon_price))])
            .range([height, 0]);

        // Création et affichage des axes
        svg.append("g")
            .attr("transform", `translate(0, ${height})`)
            .call(d3.axisBottom(x).tickFormat(d => d.slice(0, 3))); // Format mois abrégé
        svg.append("g")
            .call(d3.axisLeft(y));

        const meats = ["beef_price", "chicken_price", "lamb_price", "pork_price", "salmon_price"];
        // Récupération des couleurs
        const colors = d3.scaleOrdinal(d3.schemeCategory10).domain(meats);

        // Création des lignes pour chaque viande
        meats.forEach(meat => {
            svg.append("path")
                .datum(data.filter(d => !isNaN(d[meat])))
                .attr("fill", "none")
                .attr("stroke", colors(meat))
                .attr("stroke-width", 2)
                .attr("d", d3.line()
                    .x(d => x(d.month))
                    .y(d => y(d[meat]))
                );
        });

        // Création des légendes
        meats.forEach((meat, index) => {
            svg.append("text")
                .attr("x", width - 80)
                .attr("y", 20 + index * 20)
                .attr("fill", colors(meat))
                .text(meat.replace("_price", "").toUpperCase());
        });
    }

    function updateData() {
        // Supprime tous les graphiques précédents
        const allChart = document.querySelectorAll(".section svg");
        for (let chart of allChart) {
            chart.remove();
        }
        // TODO: gestion mode + date + noData

        // Gère les données et la couleur en fonction du mode
        let currentData;
        if (mode == "PRODUCTION") {
            currentData = dataProduction;
            color = COLOR_PRODUCTION;
        } else if (mode == "PRICE") {
            currentData = dataProduction; // TODO change
            color = COLOR_PRICE;
        } else {
            currentData = dataConsumption;
            color = COLOR_CONSUMPTION;
        }
        // Mets à jour tous les graphiques
        chartMap(currentData);
        chart1(currentData);
        chart2(dataPrice); // TODO set currentData and change that
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
        for (let m of ['consumption', 'production', 'price']) {
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