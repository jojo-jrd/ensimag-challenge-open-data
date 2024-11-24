import {initListenersFilters, initFilters} from './filters.js'

const COLOR_PRODUCTION_EMISSION = "#dc05ca",
    COLOR_CONSUMPTION_EMISSION = "#4034f8";

document.addEventListener("DOMContentLoaded", () => {
    let dataConsumption, dataProduction, dataEmission, dataFilters = {}, filters = {}, mode = "PRODUCTIONEMISSION", year = 1961, color = COLOR_PRODUCTION_EMISSION;
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
            total_from_land_to_retail : +d["Total from Land to Retail"],
            total_average : +d["Total Global Average GHG Emissions per kg"],
            unit : d["Unit of GHG Emissions"]
        }));
    }

    let valueAccessor;
    function chartMap() {
        let data;
        let total_production = 16.50;
        let total_average = 27.09;
        let total_consumption = total_average-total_production;

        if (mode == "PRODUCTIONEMISSION") {
            data = dataProduction;
        } else {
            data = dataConsumption;
        }
        
        const svg = d3.select("#graph-map")
        .append("svg")
        .attr("width", "100%")
        .attr("height", height + 200);
    
        const projection = d3.geoMercator()
            .scale(150)
            .translate([width / 1.54, height / 1]);
        
        const tooltip = d3.select("body")
            .append("div")
            .style("position", "absolute")
            .style("background-color", "white")
            .style("padding", "5px 10px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "5px")
            .style("pointer-events", "none")
            .style("opacity", 0);
    
        const path = d3.geoPath().projection(projection);
        d3.json("./../countries.geo.json").then((geoData) => {
            valueAccessor = (d) => {
                if (mode == "PRODUCTIONEMISSION") {
                    const productionData = data.find(dp => dp.code === d.id && dp.year == year);
                    return productionData? (productionData.value)*total_production : 0;
                } else {
                    const consumptionData = data.filter(dp => dp.location === d.id && dp.year == year && dp.measure === "THND_TONNE");
                    return consumptionData.length > 0 ? d3.mean(consumptionData, dp => dp.value)*total_consumption : 0;
                }
            };

            const colorScale = d3.scaleQuantile()
            .domain([0, d3.max(geoData.features, (d) => valueAccessor(d))])
            .range([
                "#00a89b", "#00988a", "#00877a", "#00766a", "#00655a",
                "#00544a", "#004439", "#003428", "#002317" 
            ]);


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
                .attr("stroke-width", 0.5)
                .on("mouseover", handleMouseOver)
                .on("mousemove", handleMouseMove)
                .on("mouseout", handleMouseOut);

            addColorLegend(svg, colorScale);
        });

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
            
                if (mode == "PRODUCTIONEMISSION") {
                    const productionData = data.find(dp => dp.code === d.id && dp.year == year);
                    infoHTML += `<br>C02/Production : ${productionData ? ((productionData.value) * total_production).toLocaleString() + " tonnes" : "Donnée indisponible"}`;
                } else {
                    const consumptionData = data.filter(dp => dp.location === d.id && dp.year == year && dp.measure === "THND_TONNE");
                    const avgConsumption = consumptionData.length > 0 
                        ? d3.mean(consumptionData, dp => dp.value)*total_consumption
                        : "Donnée indisponible";
                    infoHTML += `<br>C02/Consommation : ${avgConsumption !== "Donnée indisponible" ? avgConsumption.toLocaleString() + " tonnes" : avgConsumption}`;
                }
            
                tooltip.style("opacity", 1)
                    .html(infoHTML);
            }
        }
        
        function handleMouseMove(event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
        }
        
        function handleMouseOut() {
            tooltip.style("opacity", 0);
        }
    }
    
    function updateData() {
        // Supprime tous les graphiques précédents
        const allChart = document.querySelectorAll(".section svg");
        for (let chart of allChart) {
            chart.remove();
        }

        // Gère les données et la couleur en fonction du mode
        if (mode == "PRODUCTIONEMISSION") {
            color = COLOR_PRODUCTION_EMISSION;
        } else {
            color = COLOR_CONSUMPTION_EMISSION;
        }

        // Mets à jour tous les graphiques
        chartMap();
        // TODO charts
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