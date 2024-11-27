import {initListenersFilters, initFilters} from './filters.js'

const COLOR_PRODUCTION = "#e7a30c",
    SELECTED_COLOR_PRODUCTION = "#623e03",
    COLOR_CONSUMPTION = "#ae13bb",
    SELECTED_COLOR_CONSUMPTION = "#d13ed1",
    COLOR_PRICE = "#45b707",
    SELECTED_COLOR_PRICE = "#6ed93a";

document.addEventListener("DOMContentLoaded", () => {
    let dataConsumption, dataProduction, dataPrice, geoData, dataFilters = {}, filters = {}, mode = "PRODUCTION", year = 1961, color = COLOR_PRODUCTION, selectedColor = SELECTED_COLOR_PRODUCTION;
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
        console.log(filters["country"]);
        const index = filters["country"].indexOf(countryName);
        if (index > -1) {
            // Supprime le pays si présent
            filters["country"].splice(index, 1);
        } else {
            // Ajoute le pays si absent
            filters["country"].push(countryName);
        }
        console.log(filters["country"]);

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

        const data = getHistogramData();
        const dataPerYear = data.dataPerYear;
        const selectedCountries = data.selectedCountries;
        
        
        // Get dimensions from the DOM
        const graphDiv = document.getElementById('graph1');
        const margin = { top: 10, right: 30, bottom: 10, left: 100 };
        const width = graphDiv.clientWidth - margin.left - margin.right;
        const height = graphDiv.clientHeight - margin.top - margin.bottom;
    
        const svg = d3.select("#graph1")
            .append("svg")
            .attr("width", graphDiv.clientWidth+margin.left+margin.right)
            .attr("height", graphDiv.clientHeight)
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
        const x = d3.scaleLinear()
            .domain([0, d3.max(dataPerYear, d => d.value)])
            .range([0, width]);
    
        const y = d3.scaleBand()
            .domain(dataPerYear.map(d => d.country))
            .range([0, height])
            .padding(0.1);
    
        // Axes
        // svg.append("g")
        //     .attr("class", "axis axis--x")
        //     .attr("transform", `translate(0,${height})`)
        //     .call(d3.axisBottom(x).ticks(5));
    
        svg.append("g")
            .attr("class", "axis axis--y")
            .call(d3.axisLeft(y).tickSize(0))
            .select(".domain").remove();
    
        // Tooltip
        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("background", "white")
            .style("border", "1px solid #ccc")
            .style("padding", "5px");
    

        // Define the drop shadow filter
        const defs = svg.append("defs");
        const filter = defs.append("filter")
            .attr("id", "drop-shadow")
            .attr("height", "130%");
        
        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 1)
            .attr("result", "blur");
        
        filter.append("feOffset")
            .attr("in", "blur")
            .attr("dx", 0.5)
            .attr("dy", 0.5)
            .attr("result", "offsetBlur");
        
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode")
            .attr("in", "offsetBlur");
        feMerge.append("feMergeNode")
            .attr("in", "SourceGraphic");

        // Barres
        svg.selectAll(".bar")
        .data(dataPerYear)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("y", d => y(d.country))
        .attr("height", y.bandwidth())
        .attr("x", 0)
        .attr("width", d => x(d.value))
        .attr("rx", 5) // Set the x-axis radius for rounded corners
        .attr("ry", 5) // Set the y-axis radius for rounded corners
        .style("filter", "url(#drop-shadow)") // Apply the drop shadow filter
        .style("fill", d => selectedCountries.includes(d.country) ? selectedColor : color) // Couleur selon sélection
        .on("mouseover", function(event, d) {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            // créer une variable temporaire pour changer value en un chiffre lisible
            let value = d.value;
            if (value > 1000000) {
                value = (value / 1000000).toFixed(2) + "M";
            } else if (value > 1000) {
                value = (value / 1000).toFixed(2) + "K";
            }
            tooltip.html(`${value} tonnes`)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px")
                .style("border", "1px solid " + color)
                .style("border-radius", "5px")
                .style("box-shadow", "0 4px 8px rgba(0, 0, 0, 0.3)");
        })
        .on("mouseout", function() {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
        
        // Ajouter les valeurs dans les barres
        svg.selectAll(".label")
            .data(dataPerYear)
            .enter().append("text")
            .attr("class", "label")
            .attr("y", d => y(d.country) + y.bandwidth() / 2 + 7) // Positionner verticalement au centre de la barre
            .attr("x", d => {
                const value = parseFloat(d.value);
                return x(value) - 10 > 30 ? x(value) - 10 : x(value) + 5; // Vérifier si le label a assez de place
            })
            .attr("text-anchor", d => {
                const value = parseFloat(d.value);
                return x(value) - 10 > 30 ? "end" : "start"; // Ancrer le texte à la fin ou au début
            })
            .text(d => {
                const value = parseFloat(d.value);
                return value > 1000000 ? (value / 1000000).toFixed(2) + "M" : (value / 1000).toFixed(2) + "K";
            })
            .style("fill", d => {
                const value = parseFloat(d.value);
                return x(value) - 10 > 30 ? "white" : "black"; // Changer la couleur du texte
            })
            .style("font-size", "20px");
    }

    function getHistogramData() {
        let data;
        if (mode == "PRODUCTION") {
            data = dataProduction;
        } else if (mode == "PRICE") {
            const data1 = dataPrice; // TODO change
            const data2 = dataConsumption;
            data = getCrossedData(data1, data2);
        } else {
            data = dataConsumption;
        }
        console.log(data);

        const filteredData = data.filter(d => d.year == year && d.code !== "0" && d.code !== "OWID_WRL");
    
        // Inclure les pays sélectionnés dans filters[country]
        const selectedCountries = filters["country"] || [];
        const selectedData = filteredData.filter(d => selectedCountries.includes(d.country));
    
        // Trier par valeur pour obtenir les 7 plus grandes valeurs
        const topData = filteredData
            .filter(d => !selectedCountries.includes(d.country)) // Exclure les pays déjà sélectionnés
            .sort((a, b) => b.value - a.value)
            .slice(0, 7 - selectedData.length); // Récupérer le reste des meilleurs pays
    
        // Combiner les pays sélectionnés et les meilleurs pays
        const dataPerYear = selectedData.concat(topData).sort((a, b) => b.value - a.value);

        console.log(dataPerYear);

        //return dataPerYear and selectedCountries in an object
        const dataPerYearObj = {
            dataPerYear: dataPerYear,
            selectedCountries: selectedCountries
        }
        return dataPerYearObj;
    }

    function getCrossedData(data1, data2) {
        const data = [];
        console.log(data1);
        // Group data1 by year knowing that data1 only have monthly data ex: Sep-61, Oct-61, Nov-61. So we need to group by year and sum the values and divide by 12 and d3.nest is not a function
        const data1PerYear = data1.reduce((acc, d) => {
            let year = d.month.split('-')[1];
            let real_year = parseInt(year) > 25 ? "19" + year : "20" + year;
            if (!acc[real_year]) {
                acc[real_year] = {
                    year: real_year,
                    beef_price: 0,
                    chicken_price: 0,
                    lamb_price: 0,
                    pork_price: 0,
                    salmon_price: 0
                };
            }
            acc[real_year].beef_price += d.beef_price;
            acc[real_year].chicken_price += d.chicken_price;
            acc[real_year].lamb_price += d.lamb_price;
            acc[real_year].pork_price += d.pork_price;
            acc[real_year].salmon_price += d.salmon_price;
            // When we reach the end of the array, we divide by 12
            if (d == data1[data1.length - 1]) {
                Object.keys(acc).forEach(key => {
                    acc[key].beef_price /= 12;
                    acc[key].chicken_price /= 12;
                    acc[key].lamb_price /= 12;
                    acc[key].pork_price /= 12;
                    acc[key].salmon_price /= 12;
                });
            }
            return acc;
        }, {});
        console.log(data1PerYear);
        console.log(data2);
        const data2PerYear = data2.reduce((acc, d) => {
            if (!acc[d.year]) {
                acc[d.year] = {};
            }
            if (!acc[d.year][d.location]) {
                acc[d.year][d.location] = {
                    country: d.location
                };
            }
            // add d.type_meat to the object
            if (!acc[d.year][d.location][d.type_meat]) {
                acc[d.year][d.location][d.type_meat] = {
                    value: 0
                };
            }
            console.log(d);
            acc[d.year][d.location][d.type_meat].value = d.measure == "THND_TONNE" ? d.value*1000 : d.value;
            return acc;
        }, {});
        console.log(data2PerYear);
        // Cross data1 and data2
        Object.keys(data1PerYear).forEach(year => {
            Object.keys(data2PerYear[year]).forEach(country => {
                const countryData = data2PerYear[year][country];
                const data1Data = data1PerYear[year];
                data.push({
                    country: countryData.country,
                    year: year,
                    beef_price: data1Data.beef_price,
                    chicken_price: data1Data.chicken_price,
                    lamb_price: data1Data.lamb_price,
                    pork_price: data1Data.pork_price,
                    salmon_price: data1Data.salmon_price,
                });
            });
        });
        console.log(data);
        return data;
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

    function updateData() {
        // Supprime tous les graphiques précédents
        const allChart = document.querySelectorAll(".section svg");
        for (let chart of allChart) {
            chart.remove();
        }

        // Gère les données et la couleur en fonction du mode
        if (mode == "PRODUCTION") {
            color = COLOR_PRODUCTION;
            selectedColor = SELECTED_COLOR_PRODUCTION;
        } else if (mode == "PRICE") {
            color = COLOR_PRICE;
            selectedColor = SELECTED_COLOR_PRICE;
        } else {
            color = COLOR_CONSUMPTION;
            selectedColor = SELECTED_COLOR_CONSUMPTION;
        }

        document.documentElement.style.setProperty('--bar-color', color);
        document.documentElement.style.setProperty('--bar-hover-color', color);

        // Mets à jour tous les graphiques
        chartMap();
        chart1();
        chart2();
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