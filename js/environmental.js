import {initListenersFilters} from './filters.js'

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
            land : +d["Land Use Change"],
            feed : +d["Feed"],
            farm : +d["Farm"],
            processing : +d["Processing"],
            transport : +d["Transport"],
            packaging : +d["Packaging"],
            retail : +d["Retail"],
            total : +d["Total from Land to Retail"]
        }));
    }

    function chartPie() {
        // Récupérer le pays 
        console.log(filters);
        const country = getLastCountryAdded();
        if(country == null)
        {
            console.log(`No country selected`);
            return;
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
    
        // Gestion du mode
        if(mode === "CONSUMPTIONEMISSION") {
            meatEmissionData = dataEmission.map(emission => {
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
            meatEmissionData = dataEmission.map(emission => {
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
        const width = 500;
        const height = 500;
        const radius = Math.min(width, height) / 2;

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
        const arcs = svg.selectAll("arc")
            .data(pie(pieData))
            .enter()
            .append("g")
            .attr("class", "arc")
            .on("mouseover", function(event, d) {
                const totalEmissions = d3.sum(pieData, e => e.value);
                const percentage = ((d.data.value / totalEmissions) * 100).toFixed(2);
                tooltip.style("opacity", 1)
                    .html(`<strong>${d.data.type}</strong><br>Total Emissions: ${d.data.value.toLocaleString()} kg CO₂e<br>Percentage: ${percentage}%<br>Product: ${emissions.product}`);
            })
            .on("mousemove", function(event) {
                tooltip.style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 20) + "px");
            })
            .on("mouseout", function() {
                tooltip.style("opacity", 0);
            });

        // Ajout des arcs colorés
        arcs.append("path")
            .attr("d", arc)
            .attr("fill", d => color(d.data.type));

        // Remove 
        svg.on("mouseleave", () => d3.select(".tooltip").remove());
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

    function updateData() {
        // Supprime tous les graphiques précédents
        const allChart = document.querySelectorAll(".section svg");
        for (let chart of allChart) {
            chart.remove();
        }
        // TODO: gestion mode + date + noData

        // Gère les données et la couleur en fonction du mode
        if (mode == "PRODUCTIONEMISSION") {
            color = COLOR_PRODUCTION_EMISSION;
        } else {
            color = COLOR_CONSUMPTION_EMISSION;
        }

        // Mets à jour tous les graphiques
        // TODO charts
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

    function initFilters() {
        // TODO see for the others filters
        filters['country'] = [];
        const filtersCountries = dataProduction.map(d => d.country);
        dataFilters['country'] = filtersCountries.filter((d, index) => filtersCountries.indexOf(d) == index)
    }

    async function initPage() {
        await loadData();
        initFilters();
        initListeners();
        updateData();
    }

    initPage();
});