import {initListenersFilters, initFilters} from './filters.js'

const COLOR_PRODUCTION = "#e7a30c",
    COLOR_CONSUMPTION = "#ae13bb",
    COLOR_PRICE = "#45b707";

document.addEventListener("DOMContentLoaded", () => {
    let dataConsumption, dataProduction, dataPrice, geoData, dataFilters = {}, filters = {}, mode = "PRODUCTION", year = 1961, color = COLOR_PRODUCTION;
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

        geoData = await d3.json("./../countries.geo.json")
    }

    function countryToCodeMapping(countryName) {
        return dataProduction.find(d => d.country === countryName).code;
    }

    /*
        ==========================================
        FONCTIONS DU GRAPHIQUE CARTE
        ==========================================
    */

    function valueAccessor(d) {
        if (mode == "PRODUCTION") {
            const productionData = dataProduction.find(dp => dp.code === d.id && dp.year == year);
            return productionData ? productionData.value : 0;
        } else if (mode == "CONSUMPTION") {
            const consumptionData = dataConsumption.filter(dp => dp.location === d.id && dp.year == year && dp.measure === "THND_TONNE");
            return consumptionData.length > 0 ? d3.mean(consumptionData, dp => dp.value) : 0;
        } else if (mode == "PRICE") {
            const filteredData = dataPrice.filter(dp => dp.month.split('-')[1] == String(year).slice(-2));
            const averages = {};
            ['beef_price', 'chicken_price', 'lamb_price', 'pork_price', 'salmon_price'].forEach(type => {
                const typePrices = filteredData.map(dp => dp[type]).filter(price => price != null);
                const typeAverage = typePrices.reduce((sum, price) => sum + price, 0) / typePrices.length;
                averages[type] = typeAverage;
            });

            const overallAverage = Object.values(averages).reduce((sum, avg) => sum + avg, 0) / Object.values(averages).length;
            const consumptionData = dataConsumption.filter(dp => dp.location === d.id && dp.year == year && dp.measure === "THND_TONNE");
            const avgConsumption = consumptionData.length > 0
                ? d3.mean(consumptionData, dp => dp.value)
                : "Donnée indisponible";
            const finalvalue = overallAverage*avgConsumption
            return finalvalue ? finalvalue : 0;
        }
        return 0;
    };

    let tooltipChart;
    function addColorLegend(svg, colorScale) {
        const legendWidth = 200;
        const legendHeight = 20;

        const legendGroup = svg.append("g")
            .attr("transform", `translate(${width - legendWidth + 80}, ${height + 150})`);
        
        const gradient = svg.append("defs")
            .append("linearGradient")
            .attr("id", "blue-gradient")
            .attr("x1", "0%")
            .attr("x2", "100%")
            .attr("y1", "0%")
            .attr("y2", "0%");

        const colorRange = colorScale.range();
        colorRange.forEach((color, index) => {
            gradient.append("stop")
                .attr("offset", `${(index / (colorRange.length - 1)) * 100}%`)
                .attr("stop-color", color); 
        });

        legendGroup.append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#blue-gradient)");
        
        const numTicks = 3;
        const tickValues = d3.range(0, numTicks).map(i => d3.quantile(colorScale.domain(), i / (numTicks - 1)));
        
        legendGroup.selectAll(".legend-tick")
            .data(tickValues)
            .enter()
            .append("text")
            .attr("class", "legend-tick")
            .attr("x", (d, i) => i * (legendWidth / (numTicks - 1)))
            .attr("y", legendHeight + 15)
            .attr("text-anchor", "middle")
            .style("font-size", "10px")
            .text(d => d3.format(",.0f")(d)); 
    }        
    
    function handleMouseOver(event, d) {
        if (d.id !== "BMU") {
            let infoHTML = `<strong>${d.properties.name}</strong>`;

            if (mode == "PRODUCTION") {
                const productionData = dataProduction.find(dp => dp.code === d.id && dp.year == year);
                infoHTML += `<br>Production : ${productionData ? productionData.value.toLocaleString() + " tonnes" : "Donnée indisponible"}`;
            }

            if (mode == "CONSUMPTION") {
                const consumptionData = dataConsumption.filter(dp => dp.location === d.id && dp.year == year && dp.measure === "THND_TONNE");
                const avgConsumption = consumptionData.length > 0
                    ? d3.mean(consumptionData, dp => dp.value)
                    : "Donnée indisponible";
                infoHTML += `<br>Consommation : ${avgConsumption !== "Donnée indisponible" ? avgConsumption.toLocaleString() + " tonnes" : avgConsumption}`;
            }

            if (mode == "PRICE") {
                const filteredData = dataPrice.filter(dp => dp.month.split('-')[1] == String(year).slice(-2));
                const averages = {};
                ['beef_price', 'chicken_price', 'lamb_price', 'pork_price', 'salmon_price'].forEach(type => {
                    const typePrices = filteredData.map(dp => dp[type]).filter(price => price != null);
                    const typeAverage = typePrices.reduce((sum, price) => sum + price, 0) / typePrices.length;
                    averages[type] = typeAverage;
                });

                const overallAverage = Object.values(averages).reduce((sum, avg) => sum + avg, 0) / Object.values(averages).length;
                
                const consumptionData = dataConsumption.filter(dp => dp.location === d.id && dp.year == year && dp.measure === "THND_TONNE");
                const avgConsumption = consumptionData.length > 0
                    ? d3.mean(consumptionData, dp => dp.value)
                    : "Donnée indisponible";
                const finalvalue = overallAverage*avgConsumption
                console.log(finalvalue)
                infoHTML += `<br>Prix : ${finalvalue ? finalvalue.toLocaleString() + " € de viande consommés" : "Donnée indisponible"}`;
            }

            tooltipChart.style("opacity", 1)
                .html(infoHTML);
        }
    }

    function handleMouseMove(event) {
        tooltipChart.style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 20) + "px");
    }

    function handleMouseOut() {
        tooltipChart.style("opacity", 0);
    }

    function handleClick(event, d) {
        if (!d.id) {
            return;
        }
        // Trouver le pays dans dataProduction
        const countryData = dataProduction.find(dp => dp.code === d.id);
        if (!countryData) return; // Pas de données correspondantes

        const countryName = countryData.country;

        // Vérifie si le pays est déjà dans le filtre
        const index = filters["country"].indexOf(countryName);
        if (index > -1) {
            // Supprime le pays si présent
            filters["country"].splice(index, 1);
        } else {
            // Ajoute le pays si absent
            filters["country"].push(countryName);
        }

        updateData();
    }

    function chartMap() {
        const svg = d3.select("#graph-map")
            .append("svg")
            .attr("width", "100%")
            .attr("height", height + 200);
    
        const projection = d3.geoMercator()
            .scale(150)
            .translate([width / 1.54, height / 1]);

        if (tooltipChart) tooltipChart.remove();

        tooltipChart = d3.select("body")
            .append("div")
            .style("position", "absolute")
            .style("background-color", "white")
            .style("padding", "5px 10px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "5px")
            .style("pointer-events", "none")
            .style("opacity", 0);
    
        const path = d3.geoPath().projection(projection);
        
        const getColorRange = (mode) => {
            switch (mode) {
                case "PRODUCTION":
                    return [
                        "#fbe4a1", "#f4c670", "#eda73f", "#e79310", "#d3840d",
                        "#b7730a", "#9a6208", "#7e5005", "#623e03"
                    ];
                case "CONSUMPTION":
                    return [
                        "#f3c2f9", "#e798f2", "#db6eec", "#cf44e5", "#b63ac8",
                        "#9c31aa", "#83188e", "#690f72", "#4f0657"
                    ];
                case "PRICE":
                    return [
                        "#b9f1a8", "#94e07c", "#70d051", "#4cc026", "#3ca61d",
                        "#318417", "#276311", "#1c420b", "#112105"
                    ];
                default:
                    throw new Error(`Unknown mode: ${mode}`);
            }
        };
        
        const colorScale = d3.scaleQuantile()
            .domain([0, d3.max(geoData.features, valueAccessor)])
            .range(getColorRange(mode));        
        
        const countriesFilters = filters["country"].map(countryToCodeMapping);
        svg.selectAll("path")
            .data(geoData.features)
            .enter()
            .append("path")
            .attr("d", path)
            .attr("fill", (d) => {
                const value = valueAccessor(d);
                return value ? colorScale(value) : "#ccc";
            })
            .attr("stroke", "#333")
            .attr("stroke-width", d => countriesFilters.includes(d.id) ? 2 : 0.5) // Bordure différente pour les pays sélectionnés
            .on("mouseover", handleMouseOver)
            .on("mousemove", handleMouseMove)
            .on("mouseout", handleMouseOut)
            .on("click", handleClick); // Ajouter l'événement de clic ici

        addColorLegend(svg, colorScale);
    }
    

    function chart1() {
        // Récupérer le pays sélectionné 
        const country = getLastCountryAdded();
        if(country == null) {
            console.log('No country selected');
            return;
        }
        // Code du pays
        let code = dataProduction.find(d => d.country === country).code;
        if(code == null) {
            console.log('No code found for the country');
            return;
        }

        // Gestion du mode
        let data = mode === "CONSUMPTION"
            ? dataConsumption.filter(c => c.location === code)
            : dataProduction.filter(d => d.country === country);

        if (!data || data.length === 0) {
            console.log('No data available for the selected country and mode');
            return;
        }

        // Aggregate data 
        const dataGrouped = d3.groups(data, d => d.year).map(([year, entries]) => {
            return {
                year: year,
                value: d3.sum(entries, d => d.value) // même année
            };
        });

        dataGrouped.sort((a, b) => a.year - b.year);

        // Remove 
        d3.select("#graph1").selectAll("*").remove();

        // SVG container
        const svg = d3.select("#graph1")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        // Axes
        const x = d3.scalePoint()
            .domain(dataGrouped.map(d => d.year))
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(dataGrouped, d => d.value)])
            .range([height, 0]);

        // Ajout des axes
        // Rota 45°
        svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-45)") // Rotattion 45°
        .style("text-anchor", "end"); 
        
        // Tous les 5 ans   
        // svg.append("g")
        // .attr("transform", `translate(0, ${height})`)
        // .call(
        //     d3.axisBottom(x)
        //         .tickFormat((d, i) => (i % 5 === 0 ? d : "")) // 5 ans
        // );

        svg.append("g")
            .call(d3.axisLeft(y));

        // Create the line generator
        const line = d3.line()
            .x(d => x(d.year))
            .y(d => y(d.value));

        // Draw the line
        svg.append("path")
            .datum(dataGrouped)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 2)
            .attr("d", line);

        // Add points for each data point
        svg.selectAll(".dot")
            .data(dataGrouped)
            .enter()
            .append("circle")
            .attr("cx", d => x(d.year))
            .attr("cy", d => y(d.value))
            .attr("r", 4)
            .attr("fill", color);

        // Add a legend or title
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .text(`${mode === "PRODUCTION" ? "Production" : "Consumption"} Trends for ${country}`);

    }

    // Récupérer le dernier pays sélectionné
    function getLastCountryAdded() {
        if (filters['country'] && filters['country'].length > 0) {
            return filters['country'][filters['country'].length - 1];
        }
        return null; 
    }

    function chart2() {
        // TODO gestion des données en fonction du mode, des filtres et de l'année
        let data = dataPrice;
        // if (mode == "PRODUCTION") {
        //     data = dataProduction;
        // } else if (mode == "PRICE") {
        //     data = dataProduction; // TODO change
        // } else {
        //     data = dataConsumption;
        // }

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

    function chartPie() {    
        // Filtrer par rapport à l'année choisie, exclure les lignes ne correspondant pas à des pays
        const productionDataForYear = dataProduction
            .filter(d => d.year === year && d.code !== "0" && !isRegionOrGlobal(d.country));
        const consumptionDataForYear = dataConsumption
            .filter(d => d.year === year && d.measure === "THND_TONNE");
    
        // Aggréger les données par pays
        const aggregatedData = productionDataForYear.map(d => {
            const consumption = consumptionDataForYear.find(c => c.location === d.code); // match le code du pays
            return {
                country: d.country,
                value: mode === "PRODUCTION" ? d.value : (consumption ? consumption.value*1000 : 0)
            };
        }).filter(d => d.value > 0); // Filtrer les valeurs nulles
    
        // Top 10 (9 pays et le reste du monde cumulé)
        const sortedData = aggregatedData.sort((a, b) => b.value - a.value);
        const topData = sortedData.slice(0, 9);
        const otherDataValue = sortedData.slice(9).reduce((acc, curr) => acc + curr.value, 0);
        if (otherDataValue > 0) {
            topData.push({ country: "Other", value: otherDataValue });
        }
    
        // Calcul du total 
        const totalValue = topData.reduce((acc, d) => acc + d.value, 0);
    
        // Remove piechart
        d3.select("#pieChart").selectAll("*").remove();
    
        // Dimensions 
        const width = 300;
        const height = 300;
        const radius = Math.min(width, height) / 2;
    
        const svg = d3.select("#pieChart")
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", `translate(${width / 2}, ${height / 2})`);
    
        // Couleurs 
        const color = d3.scaleOrdinal(d3.schemeCategory10);
    
        // Tooltip setup
        const tooltip = d3.select("body").append("div")
            .style("position", "absolute")
            .style("background-color", "white")
            .style("padding", "5px 10px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "5px")
            .style("pointer-events", "none")
            .style("opacity", 0);
    
        // Création du camembert et le générateur d'arcs
        const pie = d3.pie().value(d => d.value);
        const arc = d3.arc().innerRadius(0).outerRadius(radius);
    
        // dessin des arcs 
        const arcs = svg.selectAll("arc")
            .data(pie(topData))
            .enter()
            .append("g")
            .attr("class", "arc")
            .on("mouseover", function(event, d) {
                // Create a new tooltip on hover
                const tooltip = d3.select("body").append("div")
                    .attr("class", "tooltip") 
                    .style("position", "absolute")
                    .style("background-color", "white")
                    .style("padding", "5px 10px")
                    .style("border", "1px solid #ccc")
                    .style("border-radius", "5px")
                    .style("pointer-events", "none")
                    .style("opacity", 1)
                    .html(`<strong>${d.data.country}</strong><br>Value: ${d.data.value.toLocaleString()} tonnes<br>Percentage: ${((d.data.value / totalValue) * 100).toFixed(2)}%`);
                })
            .on("mousemove", function(event) {
                d3.select(".tooltip")
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 20) + "px");
            })
            .on("mouseout", function() {
                // remove tooltip
                d3.select(".tooltip").remove();
            });
    
        // ajout des arcs colorés
        arcs.append("path")
            .attr("d", arc)
            .attr("fill", d => color(d.data.country));
    
        // reset
        svg.on("mouseleave", () => d3.select(".tooltip").remove());
    }
    
    // fonction pour exclure les regroupements
    function isRegionOrGlobal(name) {
        const regionKeywords = ["Europe", "World", "America", "Africa", "Asia", "FAO"];
        return regionKeywords.some(keyword => name.includes(keyword));
    }

    function updateData() {
        // Supprime tous les graphiques précédents
        const allChart = document.querySelectorAll(".section svg");
        for (let chart of allChart) {
            chart.remove();
        }

        // Gère les données et la couleur en fonction du mode
        if (mode == "PRODUCTION") {
            color = COLOR_PRODUCTION;
        } else if (mode == "PRICE") {
            color = COLOR_PRICE;
        } else {
            color = COLOR_CONSUMPTION;
        }

        // Mets à jour tous les graphiques
        chartMap();
        chart1();
        chart2();
        chartPie();
        // TODO other charts
    }

    /*
        ==========================================
        PARTIE DES FONCTIONS D'INITIALISATION
        ==========================================
    */

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

        // Ajoute des listeners sur les boutons
        for (let m of ['consumption', 'production', 'price']) {
            document.getElementById(`${m}Button`).addEventListener('click', () => {
                mode = m.toUpperCase();
                // Recharge les données
                updateData();
            })
        }

        // Filtre pour les recherches
        initListenersFilters(
            document.getElementById("searchInput"),
            document.getElementById("resultContainer"),
            dataFilters,
            filters,
            updateData
        );
    }

    

    async function initPage() {
        await loadData();
        initFilters(dataFilters, filters, dataConsumption, dataProduction);
        initListeners();
        updateData();
    }

    initPage();
});