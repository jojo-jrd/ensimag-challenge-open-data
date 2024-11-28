const animalColors = {
    saumon: ['#6fc1d3', 'rgb(0 63 102)', 'rgb(168 199 250)'],
    vache: ['brown', '#2D2926', '#ed6f63'],
    cochon: ['#825838', '#d3687f', '#CBCE91'],
    poule: ['#d66e06', 'brown', 'cream'],
    mouton: ['#717171', '#caa785', '#72533f']
};

let currentAnimal;

document.addEventListener('DOMContentLoaded', function () {
    // Créer le conteneur pour le graphique
    let chartContainer = document.getElementById('chart-container');
    if (!chartContainer) {
        chartContainer = document.createElement('div');
        chartContainer.id = 'chart-container';
        chartContainer.innerHTML = `
            <div id="chart-wrapper" style="display:none; position: absolute; transform: translateX(-50%); left: 50%; top: 50%; z-index: 3; background: white; padding: 20px; border: 1px solid #ccc; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 class="chart-title">Évolution des Salaires, Prix et Consommation de ${currentAnimal} en France</h2>
                <div id="chart"></div>
                <div id="tooltip" style="position: absolute; opacity: 0; pointer-events: none; background: white; border: 1px solid #ccc; padding: 10px; border-radius: 5px;"></div>
            </div>
        `;
        document.body.appendChild(chartContainer);
    }

    // Fonction pour mettre à jour le titre
    function updateChartTitle(animal) {
        if (animal=="Saumon"){
            animal="Poisson";
        }else{
            animal ="Viande de "+animal
        }
        const titleElement = document.querySelector('.chart-title'); // Sélectionner par classe
        if (titleElement) {
            titleElement.textContent = `Évolution des Salaires, Prix et Consommation de ${animal} en France`;
        }
    }

    function createCombinationChart(animal) {
        animal = animal.toLowerCase();
        console.log(animal);
        console.log(animalColors[animal]);
    
        // Charger les deux ou trois fichiers CSV en parallèle
        const fichier_prix = `../csv/prix-${animal}.csv`;
        const fichier_conso = `../csv/conso-${animal}.csv`;
        Promise.all([
            d3.csv("../csv/salaires-fr.csv"),
            d3.csv(fichier_conso),
            d3.csv(fichier_prix)
        ]).then(([salaryData, animalData, priceData]) => {
            // Préparer les données pour le graphique
            salaryData.forEach(d => {
                d.année = +d.année;
                d.ensemble = +d.ensemble;
            });
    
            animalData.forEach(d => {
                d.année = +d.année;
                d.conso_viande = +d.conso_viande;
            });
    
            priceData.forEach(d => {
                d.année = +d.année;
                d.prix_moy = +d.prix_moy;
            });
    
            // Fusionner les trois ensembles de données par année
            const mergedData = salaryData.map(s => {
                const animal = animalData.find(f => f.année === s.année);
                const price = priceData.find(f => f.année === s.année);
                return {
                    année: s.année,
                    ensemble: s.ensemble,
                    conso_viande: animal ? animal.conso_viande : null,
                    prix_moy: price ? price.prix_moy : null
                };
            });
    
            console.log("Données combinées :", mergedData);
    
            // Dimensions et marges
            const margin = { top: 50, right: 60, bottom: 50, left: 50 };
            const width = 700 - margin.left - margin.right;
            const height = 400 - margin.top - margin.bottom;
    
            // Vérifier si le SVG existe déjà
            let svg = d3.select("#chart").select("svg");
            if (svg.empty()) {
                svg = d3.select("#chart")
                    .append("svg")
                    .attr("width", 700)
                    .attr("height", 400)
                    .append("g")
                    .attr("transform", `translate(${margin.left},${margin.top})`);
            } else {
                svg = svg.select("g");
            }
    
            // Échelles
            const x = d3.scaleLinear()
                .domain(d3.extent(mergedData, d => d.année))
                .range([0, width]);
    
            const yLeft = d3.scaleLinear()
                .domain([300, 380]) // Échelle pour les salaires
                .range([height, 0]);
    
            const yRight = d3.scaleLinear()
                .domain([0, d3.max(mergedData, d => d.conso_viande) + d3.max(mergedData, d => d.conso_viande) / 2])
                .range([height, 0]);
    
            const yRight2 = d3.scaleLinear()
                .domain([0, d3.max(mergedData, d => d.prix_moy)])
                .range([height, 0]);
    
            // Supprimer les anciens axes avant d'en ajouter de nouveaux
            svg.selectAll(".axis").remove();
    
            // Axe X
            svg.append("g")
                .attr("class", "axis x-axis")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(x).tickFormat(d3.format("d")))
                .attr("stroke", "#333");
    
            // Axe Y pour les salaires
            svg.append("g")
                .attr("class", "axis y-axis-left")
                .call(d3.axisLeft(yLeft))
                .attr("color", animalColors[animal][0]);
    
            // Axe Y pour la consommation
            svg.append("g")
                .attr("class", "axis y-axis-right")
                .attr("transform", `translate(${width},0)`)
                .call(d3.axisRight(yRight))
                .attr("color", animalColors[animal][1]);
    
            // Axe Y pour le prix
            svg.append("g")
                .attr("class", "axis y-axis-right-price")
                .attr("transform", `translate(${width + 30},0)`)
                .call(d3.axisRight(yRight2))
                .attr("color", animalColors[animal][2]);
    
            const tooltip = d3.select("#tooltip");
    
            // Barres pour la consommation
            const consumptionBars = svg.selectAll(".bar-conso")
                .data(mergedData);
    
            consumptionBars.enter()
                .append("rect")
                .attr("class", "bar-conso")
                .attr("x", d => x(d.année) - 10)
                .attr("y", height) // Les barres démarrent à 0 (base du graphique)
                .attr("width", 10)
                .attr("height", 0) // Hauteur initiale de 0
                .merge(consumptionBars)
                .transition()
                .duration(1000)
                .attr("y", d => yRight(d.conso_viande))
                .attr("height", d => height - yRight(d.conso_viande))
                .attr("fill", animalColors[animal][1]);
    
            consumptionBars.exit().remove();
    
            // Barres pour le prix
            const priceBars = svg.selectAll(".bar-price")
                .data(mergedData);
    
            priceBars.enter()
                .append("rect")
                .attr("class", "bar-price")
                .attr("x", d => x(d.année))
                .attr("y", height) // Les barres démarrent à 0 (base du graphique)
                .attr("width", 10)
                .attr("height", 0) // Hauteur initiale de 0
                .merge(priceBars)
                .transition()
                .duration(1000)
                .attr("y", d => yRight2(d.prix_moy))
                .attr("height", d => height - yRight2(d.prix_moy))
                .attr("fill", animalColors[animal][2]);
    
            priceBars.exit().remove();
    
            // Courbe pour les salaires
            const line = d3.line()
                .x(d => x(d.année))
                .y(d => yLeft(d.ensemble));
    
            svg.selectAll(".salary-line").remove();
    
            svg.append("path")
                .datum(mergedData)
                .attr("class", "salary-line")
                .attr("fill", "none")
                .attr("stroke", animalColors[animal][0])
                .attr("stroke-width", 4)
                .attr("d", line)
                .on("mouseover", function(event) {
                    const lastData = mergedData[mergedData.length - 1]; // Dernière donnée
                    tooltip.transition().duration(200).style("opacity", .9);
                    tooltip.html(
                        `<strong>Salaire moyen</strong><br/>` // Remplacez 'valeur' par le nom de votre champ
                    )
                    .style("left", (event.pageX - 550) + "px")
                    .style("top", (event.pageY - 200) + "px");
            
                    // Ajouter un contour blanc lors du survol
                    d3.select(this)
                        .attr("stroke-width", 8); // Épaisseur du contour
                })
                .on("mouseout", function() {
                    tooltip.transition().duration(500).style("opacity", 0);
                    
                    // Retirer le contour blanc
                    d3.select(this)
                        .attr("stroke", animalColors[animal][0]) // Remettre la couleur originale
                        .attr("stroke-width", 4); // Remettre l'épaisseur originale
                });
    
            // Légende
            svg.selectAll(".legend").remove();
    
            const legend = svg.append("g")
                .attr("class", "legend")
                .attr("transform", `translate(${width / 3 - 100}, ${height + 30})`);
    
            // Légende pour l'indice de salaire
            legend.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", 10)
                .attr("height", 10)
                .attr("fill", animalColors[animal][0]);
    
            legend.append("text")
                .attr("x", 15)
                .attr("y", 10)
                .text("Indice de Salaire")
                .style("font-size", "12px")
                .attr("fill", animalColors[animal][0]);
    
            // Légende pour la consommation
            legend.append("rect")
                .attr("x", 120)
                .attr("y", 0)
                .attr("width", 10)
                .attr("height", 10)
                .attr("fill", animalColors[animal][1]);
    
            legend.append("text")
                .attr("x", 135)
                .attr("y", 10)
                .text(`Consommation de ${animal} (kg/hab)`)
                .style("font-size", "12px")
                .attr("fill", animalColors[animal][1]);
    
            // Légende pour le prix moyen
            legend.append("rect")
                .attr("x", 340)
                .attr("y", 0)
                .attr("width", 10)
                .attr("height", 10)
                .attr("fill", animalColors[animal][2]);
    
            legend.append("text")
                .attr("x", 355)
                .attr("y", 10)
                .text("Prix Moyen (indice)")
                .style("font-size", "12px")
                .attr("fill", animalColors[animal][2]);

            let consumptionLines = [];
            let priceLines = [];
            // Ajout des événements de hover
            svg.selectAll(".bar-conso")
                .on("mouseover", function(event, d) {
                    const tickValue = d.conso_viande;
                    const line = svg.append("line")
                        .attr("x1", 0)
                        .attr("y1", yRight(tickValue))
                        .attr("x2", width)
                        .attr("y2", yRight(tickValue))
                        .attr("stroke", "#000000")
                        .attr("stroke-dasharray", "5,5")
                        .attr("stroke-width", 1);
                    
                    consumptionLines.push(line);

                    tooltip.transition().duration(200).style("opacity", .9);
                    tooltip.html(`Consommation: ${d.conso_viande} kg/hab<br/>Année: ${d.année}`)
                        .style("left", (event.pageX - 550) + "px")
                        .style("top", (event.pageY - 200) + "px");
                    
                    d3.select(this)
                        .attr("stroke", animalColors[animal][0])
                        .attr("stroke-width", 2);
                })
                .on("mouseout", function() {
                    consumptionLines.forEach(line => line.remove());
                    consumptionLines = [];
                    tooltip.transition().duration(500).style("opacity", 0);
                    
                    d3.select(this)
                        .attr("stroke", "none");
                });

            svg.selectAll(".bar-price")
                .on("mouseover", function(event, d) {
                    const tickValue = d.prix_moy;
                    const line = svg.append("line")
                        .attr("x1", 0)
                        .attr("y1", yRight2(tickValue))
                        .attr("x2", width)
                        .attr("y2", yRight2(tickValue))
                        .attr("stroke", "#000000")
                        .attr("stroke-dasharray", "5,5")
                        .attr("stroke-width", 0.5);
                    
                    priceLines.push(line);

                    tooltip.transition().duration(200).style("opacity", .9);
                    tooltip.html(`Indice Prix: ${d.prix_moy} <br/>Année: ${d.année}`)
                        .style("left", (event.pageX - 550) + "px")
                        .style("top", (event.pageY - 200) + "px");
                    
                    d3.select(this)
                        .attr("stroke", animalColors[animal][0])
                        .attr("stroke-width", 2);
                })
                .on("mouseout", function() {
                    priceLines.forEach(line => line.remove());
                    priceLines = [];
                    tooltip.transition().duration(500).style("opacity", 0);
                    
                    d3.select(this)
                        .attr("stroke", "none");
                });
    
        }).catch(function (error) {
            console.error("Erreur lors du chargement des fichiers CSV :", error);
        });
    }
    

    // Modification du script d'événements
    const animals = document.querySelectorAll('.animal');
    const chartWrapper = document.getElementById('chart-wrapper');

    animals.forEach(animal => {
        animal.addEventListener('click', function (event) {
            updateChartTitle(this.getAttribute('alt'));
            animals.forEach(a => a.classList.remove('active'));

            if (!this.classList.contains('active')) {
                this.classList.add('active');

  
                createCombinationChart(this.getAttribute('alt')); // Crée le graphique combiné
			    // Positionne le graphique au milieu du content-box
                const contentBox = document.querySelector('.content-box');
                if (contentBox) {
                    const boxRect = contentBox.getBoundingClientRect();
                    chartWrapper.style.position = 'absolute';
                    chartWrapper.style.top = `${boxRect.top + window.scrollY}px`;
                    chartWrapper.style.display = 'block';
                    chartWrapper.style.borderRadius= '255px 15px 225px 15px / 15px 225px 15px 255px';
                    chartWrapper.style.background= 'rgb(255 255 255)';
                    chartWrapper.style.border= 'dashed 5px rgb(72 77 100)';

                }


                chartWrapper.style.display = 'block';
            } else {
                chartWrapper.style.display = 'none';
            }

            event.stopPropagation();
        });
    });

    document.addEventListener('click', function () {
        animals.forEach(a => a.classList.remove('active'));
        chartWrapper.style.display = 'none';
    });
});