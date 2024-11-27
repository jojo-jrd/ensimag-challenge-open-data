import {initListenersFilters, initFilters} from './filters.js';
import {isRegionOrGlobal, getLastCountryAdded} from './utils.js';

const COLOR_PRODUCTION = "#e7a30c",
    SELECTED_COLOR_PRODUCTION = "#623e03",
    COLOR_CONSUMPTION = "#ae13bb",
    SELECTED_COLOR_CONSUMPTION = "#d13ed1",
    COLOR_PRICE = "#45b707",
    SELECTED_COLOR_PRICE = "#6ed93a";

document.addEventListener("DOMContentLoaded", () => {
    let dataConsumption, dataProduction, dataPrice, dataPopulation, geoData, dataFilters = {}, filters = {}, mode = "PRODUCTION", year = 1961, color = COLOR_PRODUCTION, selectedColor = SELECTED_COLOR_PRODUCTION;
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

        dataPopulation = await d3.csv("./../csv/world_population.csv", d => ({
            country : d["country"],
            code : d["cca3"],
            population_2023 : +d["2023 population"],
            population_2022 : +d["2022 population"],
            population_2020 : +d["2020 population"],
            population_2015 : +d["2015 population"],
            population_2010 : +d["2010 population"],
            population_2000 : +d["2000 population"],
            population_1990 : +d["1990 population"],
            population_1980 : +d["1980 population"],
            population_1970 : +d["1970 population"]
        }));

        geoData = await d3.json("./../countries.geo.json");
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
            const selectedMeats = filters["meat"] || [];
            let consumptionData = dataConsumption.filter(dp => 
                dp.location === d.id && 
                dp.year == year && 
                dp.measure === "THND_TONNE" &&
                selectedMeats.includes(dp.type_meat)
            );
    
            if (selectedMeats.length === 0) {
                consumptionData = dataConsumption.filter(dp => dp.location === d.id && dp.year == year && dp.measure === "THND_TONNE");
            }
    
            return consumptionData.length > 0 ? d3.sum(consumptionData, dp => dp.value) : 0;
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
    function addColorLegend(svg, colorScale, width, height) {
        const legendWidth = Math.min(150, width * 0.25); 
        const legendHeight = 15;
        const paddingRight = Math.min(40, width * 0.05); 
        const paddingBottom = Math.min(20, height * 0.05); 
    
        const legendGroup = svg.append("g")
            .attr(
                "transform",
                `translate(${width - legendWidth - paddingRight}, ${height - legendHeight - paddingBottom})`
            );
    
        const gradient = svg.append("defs")
            .append("linearGradient")
            .attr("id", "color-gradient")
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
            .style("fill", "url(#color-gradient)");
    
        const numTicks = width < 500 ? 2 : 3; 
        const tickValues = d3.range(0, numTicks).map(i =>
            d3.quantile(colorScale.domain(), i / (numTicks - 1))
        );
    
        legendGroup.selectAll(".legend-tick")
            .data(tickValues)
            .enter()
            .append("text")
            .attr("class", "legend-tick")
            .attr("x", (d, i) => i * (legendWidth / (numTicks - 1))) 
            .attr("y", legendHeight + 12) 
            .attr("text-anchor", "middle")
            .style("font-size", `${Math.max(8, width * 0.015)}px`) 
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
                const selectedMeats = filters["meat"] || [];
                let consumptionData = dataConsumption.filter(dp => 
                    dp.location === d.id && 
                    dp.year == year && 
                    dp.measure === "THND_TONNE" &&
                    selectedMeats.includes(dp.type_meat)
                );
        
                if (selectedMeats.length === 0) {
                    consumptionData = dataConsumption.filter(dp => dp.location === d.id && dp.year == year && dp.measure === "THND_TONNE");
                }
                const sumConsumption = consumptionData.length > 0 ? d3.sum(consumptionData, dp => dp.value) : "Donnée indisponible";
                infoHTML += `<br>Consommation : ${sumConsumption !== "Donnée indisponible" ? sumConsumption.toLocaleString() + " tonnes" : sumConsumption}`;
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
        const container = d3.select("#graph-map");
    
        function drawMap() {
            container.select("svg").remove();
    
            const svgwidth = container.node().getBoundingClientRect().width;
            const isMobile = svgwidth < 768; // Déterminer si on est sur mobile
            const svgheight = svgwidth * (isMobile ? 0.8 : 0.6); // Ratio différent pour mobile et desktop
    
            const svg = container
                .append("svg")
                .attr("width", svgwidth)
                .attr("height", svgheight);
    
            const projection = d3.geoMercator()
                .scale(svgwidth / 6)
                .translate([svgwidth / 2, svgheight / 1.5]);
    
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
                .attr("stroke-width", d => countriesFilters.includes(d.id) ? 2 : 0.5)
                .on("mouseover", handleMouseOver)
                .on("mousemove", handleMouseMove)
                .on("mouseout", handleMouseOut)
                .on("click", handleClick);
    
            addColorLegend(svg, colorScale, svgwidth, svgheight);
        }
        drawMap();
        window.addEventListener("resize", drawMap);
    }    
    
    function chart1() {
        // Récupérer le pays sélectionné 
        const country = getLastCountryAdded(filters);
        if(country == null) {
            d3.select("#graph1").html("Select a country");
            return;
        }
        // Code du pays
        let code = dataProduction.find(d => d.country === country).code;
        if(code == null) {
            console.error('No code found for the country : ', country);
            return;
        }

        // Gestion du mode
        let data = mode === "CONSUMPTION"
            ? dataConsumption.filter(c => c.location === code)
            : dataProduction.filter(d => d.country === country);

        if (!data || data.length === 0) {
            console.log('No data available for the selected country and mode');
            d3.select("#graph1").html("No data available for the selected country and mode");
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

        // Tooltip setup
        const tooltip = d3.select("body")
            .append("div")
            .style("position", "absolute")
            .style("background", "white")
            .style("border", "1px solid #ccc")
            .style("border-radius", "5px")
            .style("padding", "8px")
            .style("pointer-events", "none")
            .style("opacity", 0)
            .style("font-size", "12px");

        // SVG container
        const container = d3.select("#graph1");
        container.html("");
        const containerNode = container.node();
        const { width: containerWidth, height: containerHeight } = containerNode.getBoundingClientRect();

        const margin = { top: 50, right: 20, bottom: 70, left: 80 };
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        const svg = container.append("svg")
            .attr("width", containerWidth)
            .attr("height", containerHeight)
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        // Axes
        const x = d3.scalePoint()
            .domain(dataGrouped.map(d => d.year))
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(dataGrouped, d => d.value)])
            .nice()
            .range([height, 0]);

        // Ajout des axes
        svg.append("g")
            .attr("transform", `translate(0, ${height})`)
            .call(d3.axisBottom(x).tickValues(dataGrouped.map((d, i) => (i % 5 === 0 ? d.year : null)).filter(d => d)))
            .selectAll("text")
            .style("text-anchor", "end");

        svg.append("g")
            .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(".2s")));

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
            .attr("fill", color)
            .on("mouseover", (event, d) => {
                tooltip.style("opacity", 1)
                    .html(`<strong>Year:</strong> ${d.year}<br><strong>Value:</strong> ${d.value.toLocaleString()}`);
            })
            .on("mousemove", (event) => {
                tooltip.style("left", `${event.pageX + 10}px`)
                    .style("top", `${event.pageY - 20}px`);
            })
            .on("mouseout", () => {
                tooltip.style("opacity", 0);
            });

        // Title
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .text(`${mode === "PRODUCTION" ? "Production" : "Consumption"} Trends for ${country}`);

        // Hide tooltip when leaving the container
        container.on("mouseleave", () => tooltip.style("opacity", 0));
    }

    function chartPie() {
        // Gestion du dataset selon le mode
        const dataForYear = mode === "PRODUCTION"
            ? dataProduction.filter(d => d.year === year && d.code !== "0" && !isRegionOrGlobal(d.country))
            : filterRealCountries(dataProduction.filter(d => d.code !== "0" && !isRegionOrGlobal(d.country)), dataConsumption.filter(d => d.year === year && d.measure === "THND_TONNE"));
    
        if (!dataForYear || dataForYear.length === 0) {
            console.error("No data available for the selected mode and year.");
            d3.select("#pieChart").html("No data available for the selected mode and year");
            return;
        }
    
        // Aggrégation par pays
        const aggregatedData = d3.groups(dataForYear, d => d.country || d.location)
            .map(([country, entries]) => ({
                country,
                value: d3.sum(entries, d => d.value)
            }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value);
    
        // TOP 10 (9 pays, 1 Other -cumul des autres pays-)
        const topCountries = aggregatedData.slice(0, 9);
        const otherValue = aggregatedData.slice(9).reduce((sum, d) => sum + d.value, 0);
        if (otherValue > 0) {
            topCountries.push({ country: "Other", value: otherValue });
        }
    
        // Total
        const totalValue = d3.sum(topCountries, d => d.value);
    
        // Reset 
        const container = d3.select("#pieChart");
        container.html("");
    
        // Node
        const containerNode = container.node();
        if (!containerNode) {
            console.error("Container with id 'pieChart' not found.");
            return;
        }
    
        // Dimensions
        const containerWidth = containerNode.getBoundingClientRect().width || 800; // Default width
        const containerHeight = containerNode.getBoundingClientRect().height || 400; // Default height
        const svgWidth = containerWidth * 0.95; 
        const svgHeight = containerHeight * 0.95;
        const radius = Math.min(svgWidth, svgHeight) / 3;
    
        if (containerWidth === 0 || containerHeight === 0) {
            console.error("Invalid container dimensions.");
            return;
        }
    
        // Create SVG 
        const svg = container.append("svg")
            .attr("width", svgWidth)
            .attr("height", svgHeight + 40); // Add extra height for the title
    
        // Titre
        const chartTitle = `${mode === "PRODUCTION" ? "Production" : "Consumption"} Distribution (${year})`;
        svg.append("text")
            .attr("x", svgWidth / 2)
            .attr("y", 20) // Position title at the top
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .style("font-family", "Arial, sans-serif")
            .text(chartTitle);
    
        // Chart group 
        const chartGroup = svg.append("g")
            .attr("transform", `translate(${svgWidth / 2}, ${(svgHeight / 2) + 20})`);
    
        // Couleurs
        const color = d3.scaleOrdinal(d3.schemeCategory10);
    
        // Tooltip
        const tooltip = d3.select("body")
            .append("div")
            .style("position", "absolute")
            .style("background-color", "white")
            .style("padding", "8px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "5px")
            .style("pointer-events", "none")
            .style("opacity", 0);
    
        const pie = d3.pie().value(d => d.value);
        const arc = d3.arc().innerRadius(0).outerRadius(radius);
    
        // Arcs
        const arcs = chartGroup.selectAll(".arc")
            .data(pie(topCountries))
            .enter()
            .append("g")
            .attr("class", "arc")
            .on("mouseover", function(event, d) {
                tooltip.style("opacity", 1)
                    .html(`<strong>${d.data.country}</strong><br>Value: ${d.data.value.toLocaleString()}<br>Percentage: ${((d.data.value / totalValue) * 100).toFixed(2)}%`);
            })
            .on("mousemove", function(event) {
                tooltip.style("left", `${event.pageX + 10}px`)
                    .style("top", `${event.pageY - 20}px`);
            })
            .on("mouseout", function() {
                tooltip.style("opacity", 0);
            });
    
        arcs.append("path")
            .attr("d", arc)
            .attr("fill", d => color(d.data.country));
    
        // Légende
        const legendContainer = chartGroup.append("g")
            .attr("transform", `translate(${radius + 50}, ${-radius})`);
    
        const legend = legendContainer.selectAll(".legend")
            .data(topCountries)
            .enter()
            .append("g")
            .attr("class", "legend")
            .attr("transform", (d, i) => `translate(0, ${i * 25})`);
    
        legend.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", d => color(d.country));
    
        legend.append("text")
            .attr("x", 20)
            .attr("y", 10)
            .style("font-size", "12px")
            .style("font-family", "Arial, sans-serif")
            .text(d => `${d.country}`);
    }    

    function chartHistogram() {
        const data = getHistogramData();
        console.log(data);
        const dataPerYear = data.dataPerYear;
        const selectedCountries = data.selectedCountries;
        const isInRange = data.isInRange;
        const mode = data.mode;

        // If the year is out of range, display a message
        if (!isInRange) {
            d3.select("#legend").html("No data available for the selected year");
            return;
        } else {
            d3.select("#legend").html("");
        }
        
        
        // Get dimensions from the DOM
        const graphDiv = document.getElementById('legend');
        const margin = { top: 40, right: 30, bottom: 10, left: 100 };
        const width = graphDiv.clientWidth - margin.left - margin.right;
        const height = graphDiv.clientHeight - margin.top - margin.bottom;

        // Remove legend children
        d3.select("#legend").selectAll("*").remove();
    
        const svg = d3.select("#legend")
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
        
        // Titre
        const title = mode === "PRODUCTION" ? "Ranking of meat production by country (" + year + ")" : mode === "CONSUMPTION" ? "Ranking of meat consumption by country (" + year + ")" : "Price ranking by type of meat (" + year + ")";

        svg.append("text")
            .attr("x", width / 2)
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .text(title);
    
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
                return x(value) - 10 > 65 ? x(value) - 10 : x(value) + 5; // Vérifier si le label a assez de place
            })
            .attr("text-anchor", d => {
                const value = parseFloat(d.value);
                return x(value) - 10 > 65 ? "end" : "start"; // Ancrer le texte à la fin ou au début
            })
            .text(d => {
                const value = parseFloat(d.value);
                if (mode === "PRICE") {
                    //truncate the value to 2 decimal places and add €/kg
                    return value.toFixed(2) + " €/kg";
                } else {
                    return value > 1000000 ? (value / 1000000).toFixed(2) + "M" : (value / 1000).toFixed(2) + "K";
                }
            })
            .style("fill", d => {
                const value = parseFloat(d.value);
                return x(value) - 10 > 65 ? "white" : "black"; // Changer la couleur du texte
            })
            .style("font-size", "20px");
    }

    function getHistogramData() {
        let data;
        if (mode == "PRODUCTION") {
            data = dataProduction;

            const filteredData = data.filter(d => d.year == year && d.code !== "0" && d.code !== "OWID_WRL");
    
            // Inclure les pays sélectionnés dans filters[country]
            const selectedCountries = filters["country"] || [];
            const selectedData = filteredData.filter(d => selectedCountries.includes(d.country));
            const topSelectedData = selectedData.sort((a, b) => b.value - a.value).slice(0, 7);

            if (selectedData.length >= 7) {
                return {
                    dataPerYear: topSelectedData,
                    selectedCountries: selectedCountries,
                    isInRange: true,
                    mode: "PRODUCTION"
                };
            }
        

            // Trier par valeur pour obtenir les 7 plus grandes valeurs
            const topData = filteredData
                .filter(d => !selectedCountries.includes(d.country)) // Exclure les pays déjà sélectionnés
                .sort((a, b) => b.value - a.value)
                .slice(0, 7 - selectedData.length); // Récupérer le reste des meilleurs pays
        
            // Combiner les pays sélectionnés et les meilleurs pays
            const dataPerYear = topSelectedData.concat(topData).sort((a, b) => b.value - a.value);

            //return dataPerYear and selectedCountries in an object
            const dataPerYearObj = {
                dataPerYear: dataPerYear,
                selectedCountries: selectedCountries,
                isInRange: true,
                mode: "PRODUCTION"
            }
            console.log(dataPerYear);
            return dataPerYearObj;
        } else if (mode == "PRICE") {
            if (year < 1990 || year > 2020) {
                return {
                    dataPerYear: [],
                    selectedCountries: [],
                    isInRange: false,
                    mode: "PRICE"
                };
            }
            data = dataPrice;
            const dataPerYear = data.reduce((acc, d) => {
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
                if (d == data[data.length - 1]) {
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
            // transformer dataPerYear en array avec comme clé l'année, dans chaque élément on retrouvera les autres clés avec comme valeur le nom, le prix et la couleur
            const dataPerYearArray = Object.keys(dataPerYear).map(year => {
                return {
                    year: year,
                    beef_price: {
                        country: "Beef",
                        value: dataPerYear[year].beef_price
                    },
                    chicken_price: {
                        country: "Chicken",
                        value: dataPerYear[year].chicken_price
                    },
                    lamb_price: {
                        country: "Lamb",
                        value: dataPerYear[year].lamb_price
                    },
                    pork_price: {
                        country: "Pork",
                        value: dataPerYear[year].pork_price
                    },
                    salmon_price: {
                        country: "Salmon",
                        value: dataPerYear[year].salmon_price
                    }
                };
            });
            // On cherche l'année égale à year
            const selectedYear = dataPerYearArray.find(d => d.year == year);
            // On supprime l'année
            delete selectedYear.year
            // On trie les données par prix
            const sortedData = Object.values(selectedYear).filter(d => d.name != "year" && d.value > 0).sort((a, b) => b.value - a.value);
            // On retourne les données triées
            console.log(sortedData);
            //On supprime les données qui ont un prix à 0 ou NaN
            return {
                dataPerYear: sortedData,
                selectedCountries: [],
                isInRange: true,
                mode: "PRICE"
            };
        } else {
            if (year < 1990) {
                return {
                    dataPerYear: [],
                    selectedCountries: [],
                    isInRange: false,
                    mode: "CONSUMPTION"
                };
            }
            data = dataConsumption;
            const dataPop = dataPopulation;
            console.log(dataPop);
            console.log(data);
            // Filtre les données pour l'année sélectionnée
            const filteredData = data.filter(d => d.year == year && d.measure === "KG_CAP");
            // On regroupe les données par pays en ayant la somme des valeurs et en gardant pour chaque valeur la clé et la valeur
            const dataPerYear = d3.groups(filteredData, d => d.location).map(([location, entries]) => {
                // get the population for the country
                const population = dataPop.find(d => d.code == location);
                console.log(population);
                if (!population) {
                    return;
                }
                // The population are regrouped every 10 years, we need to find the closest year, if the last number is 5 or more we take the next 10 year, else we take the previous 10 year
                const popYear = Math.floor(year / 10) * 10;
                console.log(popYear);
                const pop = population[`population_${popYear}`];
                console.log(pop);
                return {
                    country: location,
                    value: d3.sum(entries, d => d.value*pop/1000), // On multiplie par la population pour avoir la consommation totale
                    values: entries.map(d => {
                        return {
                            key: d.type_meat,
                            value: d.value*pop/1000
                        };
                    })
                };
            });
            console.log(dataPerYear);
            // On trie les données par valeur et on garde les 7 premières valeurs
            const topData = dataPerYear.filter(d => d).sort((a, b) => b.value - a.value).slice(0, 7);
            // On retourne les données triées
            return {
                dataPerYear: topData,
                selectedCountries: [],
                isInRange: true,
                mode: "CONSUMPTION"
            };
        }
    }
    
    function filterRealCountries(consumptionData, productionData) {
        // Vrais pays dans production data
        const validCountryCodes = new Set(productionData.map(d => d.code));
    
        // Separate invalid codes
        const invalidCodes = new Set();

        // Filter consumption data to include only rows with valid codes
        const filteredConsumptionData = consumptionData.filter(d => {
            if (!validCountryCodes.has(d.location)) {
                invalidCodes.add(d.location); // Track invalid codes
                return false; // Exclude invalid rows
            }
            return true; // Include valid rows
        });

        return filteredConsumptionData;
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
        chartPie();
        chartHistogram();
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