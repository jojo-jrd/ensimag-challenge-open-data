import {initListenersFilters, initFilters} from './filters.js';
import {isRegionOrGlobal, getLastCountryAdded} from './utils.js';

const COLOR_PRODUCTION_EMISSION = "#dc05ca",
    COLOR_SELECTED_PRODUCTION_EMISSION = "#3d0035",
    COLOR_CONSUMPTION_EMISSION = "#4034f8",
    COLOR_SELECTED_CONSUMPTION_EMISSION = "#0e1f9d";

document.addEventListener("DOMContentLoaded", () => {
    let dataConsumption, dataProduction, dataEmission, dataPopulation, geoData, dataFilters = {}, filters = {}, mode = "PRODUCTIONEMISSION", year = 1961, color = COLOR_PRODUCTION_EMISSION, selectedColor = COLOR_SELECTED_PRODUCTION_EMISSION;
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
            land : +d["Land Use Change"],
            feed : +d["Feed"],
            farm : +d["Farm"],
            processing : +d["Processing"],
            transport : +d["Transport"],
            packaging : +d["Packaging"],
            retail : +d["Retail"],
            total_from_land_to_retail : +d["Total from Land to Retail"],
            total_average : +d["Total Global Average GHG Emissions per kg"],
            unit : d["Unit of GHG Emissions"]
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
        let total_production = dataEmission.reduce((acc, item) => acc + item.total_from_land_to_retail, 0) / dataEmission.length;
        let total_average = dataEmission.reduce((acc, item) => acc + item.total_average, 0) / dataEmission.length;
        let total_consumption = total_average-total_production;

        if (mode == "PRODUCTIONEMISSION") {
            const productionData = dataProduction.find(dp => dp.code === d.id && dp.year == year);
            return productionData? (productionData.value)*total_production : 0;
        } else {
            const consumptionData = dataConsumption.filter(dp => dp.location === d.id && dp.year == year && dp.measure === "THND_TONNE");
            return consumptionData.length > 0 ? d3.sum(consumptionData, dp => dp.value)*total_consumption : 0;
        }
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
        const totalProductionSum = dataEmission.reduce((sum, item) => sum + item.total_from_land_to_retail, 0);
        const totalAverageSum = dataEmission.reduce((sum, item) => sum + item.total_average, 0);
        const itemCount = dataEmission.length;

        let total_production = totalProductionSum / itemCount;
        let total_average = totalAverageSum / itemCount;
        let total_consumption = total_average-total_production;
        if (d.id !== "BMU") {
            let infoHTML = `<strong>${d.properties.name}</strong>`;
        
            if (mode == "PRODUCTIONEMISSION") {
                const productionData = dataProduction.find(dp => dp.code === d.id && dp.year == year);
                infoHTML += `<br>C02/Production : ${productionData ? ((productionData.value) * total_production).toLocaleString() + " tonnes" : "Donnée indisponible"}`;
            } else {
                const consumptionData = dataConsumption.filter(dp => dp.location === d.id && dp.year == year && dp.measure === "THND_TONNE");
                const avgConsumption = consumptionData.length > 0 
                    ? d3.sum(consumptionData, dp => dp.value)*total_consumption
                    : "Donnée indisponible";
                infoHTML += `<br>C02/Consommation : ${avgConsumption !== "Donnée indisponible" ? avgConsumption.toLocaleString() + " tonnes" : avgConsumption}`;
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

        const getColorRangeForMode = (mode) => {
            if (mode === "PRODUCTIONEMISSION") {
                return [
                    "#f7b3d6", "#f286c1", "#e35aa5", "#d32d89", "#dc05ca",
                    "#b900a4", "#8f007f", "#66005a", "#3d0035"
                ];
            } else {
                return [
                    "#a09cf7", "#7a79f1", "#5556ea", "#3133e4", "#4034f8",
                    "#2c2bcb", "#191a9e", "#14147b", "#0e1f9d"
                ];
            }
        };

        const colorScale = d3.scaleQuantile()
            .domain([0, d3.max(geoData.features, valueAccessor)])
            .range(getColorRangeForMode(mode));

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
        const country = getLastCountryAdded(filters);
        if (!country) {
            d3.select("#graph1").html("Select a country");
            return;
        }
        console.log("country : ", country);

        // Récupérer la/les viande(s)
        let meat = getSelectedMeat();
        if(meat == null) {
            meat = dataEmission.map(e => e.product.toLowerCase()); // Default
        }
    
        // Données du pays
        const countryData = dataProduction.find(d => d.country === country);
        if (!countryData) {
            console.error("No production data found for the selected country");
            return;
        }
        // Code du pays
        const code = countryData.code;
    
        // Gestion du dataset selon le mode
        const data = mode === "PRODUCTIONEMISSION"
            ? dataProduction.filter(d => d.country === countryData.country)
            : dataConsumption.filter(d => d.location === code);
    
        if (!data || data.length === 0) {
            console.log("No data available for the selected country and mode");
            d3.select("#graph1").html("No data available for the selected country and mode");
            return;
        }

        console.log("data", data);
    
        // Aggregate emissions
        const aggregatedData = data.map(d => {
            const year = d.year;

            const baseEmission = mode === "PRODUCTIONEMISSION"
                ? dataEmission.reduce((sum, e) => sum + (e.total_average * d.value || 0), 0) 
                : dataEmission.reduce((sum, e) => {
                    if (meat.some(m => e.product.toLowerCase().includes(m.toLowerCase()))) {
                        const matchingMeat = dataConsumption.find
                                                (c => c.location === d.location && c.year === year &&
                                                    e.product.toLowerCase().includes(c.type_meat.toLowerCase())
                        );
                        return sum + (matchingMeat ? e.total_average * matchingMeat.value * 1000 : 0);
                    }
                    return sum;
                }, 0);

            return { year, value: baseEmission };
        });
        aggregatedData.sort((a, b) => a.year - b.year);
    
        if (aggregatedData.length === 0) {
            console.error("No aggregated data available for the chart.");
            return;
        }

        console.log("aggregatedData", aggregatedData);
    
        // Remove
        d3.select("#graph1").selectAll("*").remove();
        d3.select("#graph1").html("");

        // Dimensions
        const container = d3.select("#graph1");
        const containerNode = container.node();
        if (!containerNode) {
            console.error("Container with id 'graph1' not found in the DOM.");
            return;
        }
        const { width: containerWidth, height: containerHeight } = containerNode.getBoundingClientRect();
        const margin = { top: 40, right: 15, bottom: 70, left: 85 };
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        if (width <= 0 || height <= 0) {
            console.error("Invalid container dimensions for the chart.");
            return;
        }
    
        // SVG container
        const svg = d3.select("#graph1")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        // Tooltip container
        const tooltip = d3.select("#graph1")
        .append("div")
        .style("position", "absolute")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("border-radius", "5px")
        .style("padding", "8px")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("font-size", "12px");
    
        // Axes
        const x = d3.scalePoint()
            .domain(aggregatedData.map(d => d.year))
            .range([0, width]);
    
        const y = d3.scaleLinear()
            .domain([0, d3.max(aggregatedData, d => d.value)])
            .nice()
            .range([height, 0]);
    
        // Ajout des axes
        // Tous les 5 ans   
        svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(
            d3.axisBottom(x)
                .tickFormat((d, i) => (i % 5 === 0 ? d : "")) // 5 ans
        );
    
        svg.append("g").call(d3.axisLeft(y));
    
        // Line
        const line = d3.line()
            .x(d => x(d.year))
            .y(d => y(d.value));
    
        // Draw 
        svg.append("path")
            .datum(aggregatedData)
            .attr("fill", "none")
            .attr("stroke", mode === "PRODUCTIONEMISSION" ? COLOR_PRODUCTION_EMISSION : COLOR_CONSUMPTION_EMISSION)
            .attr("stroke-width", 2)
            .attr("d", line);
    
        // Points
        svg.selectAll(".dot")
        .data(aggregatedData)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.value))
        .attr("r", 4)
        .attr("fill", mode === "PRODUCTIONEMISSION" ? COLOR_PRODUCTION_EMISSION : COLOR_CONSUMPTION_EMISSION)
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
        
        // Titre
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .text(`${mode === "PRODUCTIONEMISSION" ? "Production Emissions" : "Consumption Emissions"} Trends for ${country}`);
    }    

    function chartPie() {
        // Récupérer le pays 
        const country = getLastCountryAdded(filters);
        if(country == null) {
            d3.select("#pieChart").html("Select a country");
            return;
        }

        // Récupérer la/les viande(s)
        const meat = getSelectedMeat();

        // Filtrer par rapport à l'année choisie, exclure les lignes ne correspondant pas à des pays
        const productionDataForYear = dataProduction
            .filter(d => d.year === year && d.code !== "0" && !isRegionOrGlobal(d.country));
        const consumptionDataForYear = dataConsumption
            .filter(d => d.year === year && d.measure === "THND_TONNE");

        // Récupérer le pays
        let dataCountry = productionDataForYear.find(d => d.country === country);

        // Pays inconnu
        if (!dataCountry) {
            console.error(`No data found for country: ${country}`);
            d3.select("#pieChart").html("Select a country");
            return;
        }

        let meatEmissionData;
        // Filtrer les données d'émissions en fonction de la viande sélectionnée
        const filteredEmissionData = meat
        ? dataEmission.filter(emission => meat.some(meat => emission.product.toLowerCase().includes(meat.toLowerCase())))
        : dataEmission;
    
        // Gestion du mode
        if(mode === "CONSUMPTIONEMISSION") {
            meatEmissionData = filteredEmissionData.map(emission => {
                // match
                const relatedConsumption = consumptionDataForYear.find(cons => {
                    return cons.location === dataCountry.code 
                        && emission.product.toLowerCase().includes(cons.type_meat);
                });
            
                if (!relatedConsumption) {
                    console.error("PROB RELATED CONS: No consumption match for", emission.product, "code :", dataCountry.code);
                    d3.select("#pieChart").html(`No consumption match for ${dataCountry.code} in ${year}`);
                    return {
                        product: emission.product,
                        total: 0,
                        volume: 0,
                        land: 0,
                        feed: 0,
                        farm: 0,
                        processing: 0,
                        transport: 0,
                        packaging: 0,
                        retail: 0,
                    }; 
                }
                            
                const volume = relatedConsumption?.value ? relatedConsumption.value * 1000 : 0;
                const total = (emission.total || 0) * volume;
    
                return {
                    product: emission.product,
                    total: total,
                    volume: volume,
                    land: (emission.land || 0) * volume,
                    feed: (emission.feed || 0) * volume,
                    farm: (emission.farm || 0) * volume,
                    processing: (emission.processing || 0) * volume,
                    transport: (emission.transport || 0) * volume,
                    packaging: (emission.packaging || 0) * volume,
                    retail: (emission.retail || 0) * volume
                };
            }).filter(item => item && item.volume > 0 || item.total > 0);
        } else {
            meatEmissionData = filteredEmissionData.map(emission => {
                const relatedProduction = productionDataForYear.find(d => d.country === country);;
            
                // calcul
                const volume = relatedProduction.value; 
            
                return {
                    product: emission.product,
                    volume: volume, 
                    land: emission.land * volume || 0, 
                    feed: emission.feed * volume || 0, 
                    farm: emission.farm * volume || 0, 
                    processing: emission.processing * volume || 0, 
                    transport: emission.transport * volume || 0, 
                    packaging: emission.packaging * volume || 0, 
                    retail: emission.retail * volume || 0, 
                    total: emission.total * volume || 0 
                };
            }).filter(item => item !== null);
        }

        if (meatEmissionData.length === 0) {
            console.error("No valid emission data available for chart.");
            return;
        }

        // Calcul de la moyenne pondérée
        const totalVolume = meatEmissionData.reduce((sum, item) => sum + item.volume, 0);
        const weightedAverageEmissions = totalVolume > 0
            ? meatEmissionData.reduce((sum, item) => sum + (item.volume * item.total), 0) / totalVolume
            : 0;

        // Calcul des contributions pour chaque étape du cycle de vie
        const totalVolumeForChart = totalVolume > 0 ? totalVolume : 1; // cas division par zero
        const emissions = {
            land: meatEmissionData.reduce((sum, item) => sum + (item.volume * item.land || 0), 0) / totalVolumeForChart,
            feed: meatEmissionData.reduce((sum, item) => sum + (item.volume * item.feed || 0), 0) / totalVolumeForChart,
            farm: meatEmissionData.reduce((sum, item) => sum + (item.volume * item.farm || 0), 0) / totalVolumeForChart,
            processing: meatEmissionData.reduce((sum, item) => sum + (item.volume * item.processing || 0), 0) / totalVolumeForChart,
            transport: meatEmissionData.reduce((sum, item) => sum + (item.volume * item.transport || 0), 0) / totalVolumeForChart,
            packaging: meatEmissionData.reduce((sum, item) => sum + (item.volume * item.packaging || 0), 0) / totalVolumeForChart,
            retail: meatEmissionData.reduce((sum, item) => sum + (item.volume * item.retail || 0), 0) / totalVolumeForChart,
        };

        // Dimensions 
        const container = d3.select("#pieChart");
        container.html("");

        // dimensions depuis le node 
        const containerNode = container.node();
        if (!containerNode) {
            console.error("Container with id 'pieChart' not found in the DOM.");
            return;
        }
        // Dimensions
        const containerWidth = containerNode.getBoundingClientRect().width || 400; // Default width
        const containerHeight = containerNode.getBoundingClientRect().height || 400; // Default height
        const svgWidth = containerWidth * 0.95;
        const svgHeight = containerHeight * 0.85; 
        const radius = Math.min(svgWidth, svgHeight) / 3.5; 

        if (containerWidth === 0 || containerHeight === 0) {
            console.error("Invalid container dimensions.");
            return;
        }

        // Mapping
        const pieData = [
            { type: "Land Use Change", value: emissions.land || 0 },
            { type: "Feed", value: emissions.feed || 0 },
            { type: "Farm", value: emissions.farm || 0 },
            { type: "Processing", value: emissions.processing || 0 },
            { type: "Transport", value: emissions.transport || 0 },
            { type: "Packaging", value: emissions.packaging || 0 },
            { type: "Retail", value: emissions.retail || 0 }
        ].filter(d => d.value > 0); // Remove stages with 0 or invalid values

        // Remove container
        d3.select("#pieChart").selectAll("*").remove();
        d3.select("#pieChart").html("");

        // Container svg 
        const svg = d3.select("#pieChart")
            .append("svg")
            .attr("width", svgWidth)
            .attr("height", svgHeight + 40)
        
        // Titre
        svg.append("text")
            .attr("x", svgWidth / 2)
            .attr("y", 20) // Position title at the top
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .style("font-family", "Arial, sans-serif")
            .text("Emissions distribution by stage");
        
        // Chart group 
        const chartGroup = svg.append("g")
        .attr("transform", `translate(${svgWidth * 0.3}, ${(svgHeight / 2) + 20})`);

        // Couleurs
        const color = d3.scaleOrdinal(d3.schemeCategory10);

        // Générateurs pie & arcs
        const pie = d3.pie().value(d => d.value);
        const arc = d3.arc().innerRadius(0).outerRadius(radius);

        // Tooltip setup
        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("background-color", "white")
            .style("padding", "5px 10px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "5px")
            .style("pointer-events", "none")
            .style("opacity", 0);

        // Dessin des arc
        const arcs = chartGroup
        .selectAll(".arc")
        .data(pie(pieData))
        .enter()
        .append("g")
        .attr("class", "arc");

        // Tooltip behavior
        arcs.on("mouseover", function (event, d) {
            const totalEmissions = d3.sum(pieData, e => e.value);
            const percentage = ((d.data.value / totalEmissions) * 100).toFixed(2);
            tooltip.style("opacity", 1)
                .html(`<strong>${d.data.type}</strong><br>Total Emissions: ${d.data.value.toLocaleString()} kg CO₂e<br>Percentage: ${percentage}%`);
        })
        .on("mousemove", function (event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function () {
            tooltip.style("opacity", 0); // hide the tooltip
        });

        arcs.append("path")
            .attr("d", arc)
            .attr("fill", d => color(d.data.type));

        // Légende
        const legend = svg.append("g")
        .attr("transform", `translate(${svgWidth / 2 + radius - 20}, ${svgHeight / 2 - (pieData.length * 10) / 2})`);

        const legendItems = legend.selectAll(".legend-item")
        .data(pieData)
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`);

        legendItems.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", d => color(d.type));

        legendItems.append("text")
        .attr("x", 20)
        .attr("y", 10)
        .style("font-size", "12px")
        .style("font-family", "Arial, sans-serif")
        .style("text-anchor", "start")
        .text(d => `${d.type}`);


        // Hide tooltip when leaving the container
        container.on("mouseleave", () => tooltip.style("opacity", 0));
    }

    function chartHistogram() {
        const data = getHistogramData();
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
        const title = mode === "PRODUCTION" ? "Ranking of CO2 emission for production (" + year + ")" : "Ranking of CO2 emission for consumption (" + year + ")";

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
            } else {
                value = value.toFixed(2);
            }
            tooltip.html(`${value} Kg CO2e`)
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
                return x(value) - 10 > 80 ? x(value) - 10 : x(value) + 5; // Vérifier si le label a assez de place
            })
            .attr("text-anchor", d => {
                const value = parseFloat(d.value);
                return x(value) - 10 > 80 ? "end" : "start"; // Ancrer le texte à la fin ou au début
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
                return x(value) - 10 > 80 ? "white" : "black"; // Changer la couleur du texte
            })
            .style("font-size", "20px");
    }

    function getHistogramData() {
        let data;
        console.log("mode", mode);
        if (mode == "PRODUCTIONEMISSION") {
            let total_production = dataEmission.reduce((acc, item) => acc + item.total_from_land_to_retail, 0) / dataEmission.length;
            data = dataProduction;
            // Get the production data for the selected year
            data = data.filter(d => d.year == year && d.code !== "0" && d.code !== "OWID_WRL");
            // Get the total emissions for each country
            const dataPerCountry = data.map(d => {
                return {
                    country: d.country,
                    value: d.value * total_production
                };
            });
            console.log("dataPerCountry", dataPerCountry);
            // Sort the data by value
            dataPerCountry.sort((a, b) => b.value - a.value);


            const selectedCountries = filters["country"];

            if (selectedCountries.length >= 7) {
                // Only keep the selected countries in dataPerCountry
                const TopSelected = dataPerCountry.filter(d => selectedCountries.includes(d.country)).slice(0, 7);
                return {
                    dataPerYear: TopSelected,
                    selectedCountries: selectedCountries,
                    isInRange: data.length > 0,
                    mode: "PRODUCTION"
                };
            }

            const numberOfSelectedNotInTop = selectedCountries.filter(d => !dataPerCountry.map(d => d.country).includes(d));

            // On fait en sorte de garder les pays séléctionnés dans le top 7
            const topCountries = dataPerCountry.slice(0, 7 - numberOfSelectedNotInTop.length);
            for (let country of selectedCountries) {
                const countryData = dataPerCountry.find(d => d.country === country);
                if (countryData) {
                    topCountries.push(countryData);
                }
            }

            return {
                dataPerYear: topCountries,
                selectedCountries: selectedCountries,
                isInRange: data.length > 0,
                mode: "PRODUCTION"
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
            let total_production = dataEmission.reduce((acc, item) => acc + item.total_from_land_to_retail, 0) / dataEmission.length;
            let total_average = dataEmission.reduce((acc, item) => acc + item.total_average, 0) / dataEmission.length;
            let total_consumption = total_average-total_production;
            data = dataConsumption;
            const dataPop = dataPopulation;
            // Get the consumption data for the selected year
            data = data.filter(d => d.year == year && d.measure == "KG_CAP");
            console.log("data", data);
            const dataPerCountry = d3.groups(data, d => d.location).map(([location, entries]) => {
                const total = d3.sum(entries, d => d.value);
                const population = dataPop.find(d => d.code == location);
                if (!population) {
                    return;
                }
                // The population are regrouped every 10 years, we need to find the closest year, if the last number is 5 or more we take the next 10 year, else we take the previous 10 year
                const popYear = Math.floor(year / 10) * 10;
                const pop = population[`population_${popYear}`];
                return {
                    country: location,
                    value: total*pop/1000*total_consumption
                };
            }
            );
            console.log("dataPerCountry", dataPerCountry);
            // Sort the data by value
            dataPerCountry.sort((a, b) => b.value - a.value);
            // Only keep the top 7 countries
            const topCountries = dataPerCountry.slice(0, 7);

            return {
                dataPerYear: topCountries,
                selectedCountries: [],
                isInRange: data.length > 0,
                mode: "CONSUMPTION"
            };
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
            selectedColor = COLOR_SELECTED_PRODUCTION_EMISSION;
        } else {
            color = COLOR_CONSUMPTION_EMISSION;
            selectedColor = COLOR_SELECTED_CONSUMPTION_EMISSION;
        }

        // Mets à jour tous les graphiques
        chartMap();
        // TODO charts
        chartHistogram();
        chart1();
        chartPie();
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