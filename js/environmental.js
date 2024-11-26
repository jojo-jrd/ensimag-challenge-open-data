import {initListenersFilters, initFilters} from './filters.js'

const COLOR_PRODUCTION_EMISSION = "#dc05ca",
    COLOR_CONSUMPTION_EMISSION = "#4034f8";

document.addEventListener("DOMContentLoaded", () => {
    let dataConsumption, dataProduction, dataEmission, geoData, dataFilters = {}, filters = {}, mode = "PRODUCTIONEMISSION", year = 1961, color = COLOR_PRODUCTION_EMISSION;
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
        // TODO LOAD DYNAMICALLY
        let total_production = 16.50;
        let total_average = 27.09;
        let total_consumption = total_average-total_production;
        if (mode == "PRODUCTIONEMISSION") {
            const productionData = dataProduction.find(dp => dp.code === d.id && dp.year == year);
            return productionData? (productionData.value)*total_production : 0;
        } else {
            const consumptionData = dataConsumption.filter(dp => dp.location === d.id && dp.year == year && dp.measure === "THND_TONNE");
            return consumptionData.length > 0 ? d3.mean(consumptionData, dp => dp.value)*total_consumption : 0;
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
        // TODO LOAD DYNAMICALLY
        let total_production = 16.50;
        let total_average = 27.09;
        let total_consumption = total_average-total_production;
        if (d.id !== "BMU") {
            let infoHTML = `<strong>${d.properties.name}</strong>`;
        
            if (mode == "PRODUCTIONEMISSION") {
                const productionData = dataProduction.find(dp => dp.code === d.id && dp.year == year);
                infoHTML += `<br>C02/Production : ${productionData ? ((productionData.value) * total_production).toLocaleString() + " tonnes" : "Donnée indisponible"}`;
            } else {
                const consumptionData = dataConsumption.filter(dp => dp.location === d.id && dp.year == year && dp.measure === "THND_TONNE");
                const avgConsumption = consumptionData.length > 0 
                    ? d3.mean(consumptionData, dp => dp.value)*total_consumption
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

        const colorScale = d3.scaleQuantile()
        .domain([0, d3.max(geoData.features, (d) => valueAccessor(d))])
        .range([
            "#00a89b", "#00988a", "#00877a", "#00766a", "#00655a",
            "#00544a", "#004439", "#003428", "#002317" 
        ]);
        // TODO color

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
        if (!country) {
            console.log("No country selected");
            return;
        }

        // Récupérer la/les viande(s)
        let meat = getSelectedMeat();
        if(meat == null) {
            console.log(`No meat selected`);
            meat = dataEmission.map(e => e.product.toLowerCase()); // Default
        }
    
        // Données du pays
        const countryData = dataProduction.find(d => d.country === country);
        if (!countryData) {
            console.log("No production data found for the selected country");
            return;
        }
        // Code du pays
        const code = countryData.code;
    
        // Gestion du dataset selon le mode
        const data = mode === "PRODUCTIONEMISSION"
            ? dataProduction.filter(d => d.code === code)
            : dataConsumption.filter(d => d.location === code);
    
        if (!data || data.length === 0) {
            console.log("No data available for the selected country and mode");
            return;
        }
    
        // Aggregate emissions
        const aggregatedData = data.map(d => {
            const year = d.year;

            const baseEmission = mode === "PRODUCTIONEMISSION"
                ? dataEmission.reduce((sum, e) => sum + (e.total_average * d.value || 0), 0) 
                : dataEmission.reduce((sum, e) => {
                    console.log("e.product : ", e.product);
                    console.log("meat", meat);
                    if (meat.some(m => e.product.toLowerCase().includes(m.toLowerCase()))) {
                        const matchingMeat = dataConsumption.find
                                                (c => c.location === d.location && c.year === year &&
                                                    e.product.toLowerCase().includes(c.type_meat.toLowerCase())
                        );
                        console.log("matchingMeat", matchingMeat);
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
            .domain(aggregatedData.map(d => d.year))
            .range([0, width]);
    
        const y = d3.scaleLinear()
            .domain([0, d3.max(aggregatedData, d => d.value)])
            .range([height, 0]);
    
        // Ajout des axes
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
            .attr("fill", mode === "PRODUCTIONEMISSION" ? COLOR_PRODUCTION_EMISSION : COLOR_CONSUMPTION_EMISSION);
    
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
        const country = getLastCountryAdded();
        if(country == null) {
            console.log(`No country selected`);
            return;
        }

        // Récupérer la/les viande(s)
        const meat = getSelectedMeat();
        if(meat == null) {
            console.log(`No meat selected`);
        }

        console.log("Year : ", year);
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
                    return null; 
                }
                
                console.log("relatedConsumption", relatedConsumption);
            
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
            }).filter(item => item && item.volume > 0 && item.total > 0);
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

        console.log("meatEmissionsData", meatEmissionData);

        // Calcul de la moyenne pondérée
        const totalVolume = meatEmissionData.reduce((sum, item) => sum + item.volume, 0);
        const weightedAverageEmissions = totalVolume > 0
            ? meatEmissionData.reduce((sum, item) => sum + (item.volume * item.total), 0) / totalVolume
            : 0;

        console.log("Weighted Average Emissions:", weightedAverageEmissions.toFixed(2));

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

        console.log("emissions", emissions);

        // Dimensions 
        const container = d3.select("#pieChart");
        container.html("");

        // dimensions depuis le node 
        const containerNode = container.node();
        if (!containerNode) {
            console.error("Container with id 'pieChart' not found in the DOM.");
            return;
        }
        const { width, height } = containerNode.getBoundingClientRect();
        const radius = Math.min(width, height) / 2;

        if (width === 0 || height === 0) {
            console.error("Invalid container dimensions for the pie chart.");
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

        console.log("Pie Data:", pieData); // Debug

        // Remove container
        d3.select("#pieChart").selectAll("*").remove();

        // Container svg 
        const svg = d3.select("#pieChart")
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", `translate(${width / 2}, ${height / 2})`);

        if (!d3.select("#pieChart").node()) {
            console.error("Container with id 'pieChart' not found in the DOM.");
            return;
        }

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
        const arcs = svg
        .selectAll(".arc")
        .data(pie(pieData))
        .enter()
        .append("g")
        .attr("class", "arc");

        arcs.append("path")
            .attr("d", arc)
            .attr("fill", d => color(d.data.type));

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

        // Hide tooltip when leaving the container
        container.on("mouseleave", () => tooltip.style("opacity", 0));
    }

    // Fonction pour exclure les regroupements
    function isRegionOrGlobal(name) {
        const regionKeywords = ["Europe", "World", "America", "Africa", "Asia", "FAO"];
        return regionKeywords.some(keyword => name.includes(keyword));
    }

    // Récupérer le dernier pays sélectionné
    function getLastCountryAdded() {
        if (filters['country'] && filters['country'].length > 0) {
            return filters['country'][filters['country'].length - 1];
        }
        return null; 
    }

    // Récupérer la viande sélectionnée
    function getSelectedMeat() {
        if (filters['meat'] && filters['meat'].length > 0) {
            return filters['meat']; 
        }
        //return []; 
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