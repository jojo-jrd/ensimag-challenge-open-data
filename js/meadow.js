document.addEventListener('DOMContentLoaded', function () {
    // Créer le conteneur pour le graphique
    let chartContainer = document.getElementById('chart-container');
    if (!chartContainer) {
        chartContainer = document.createElement('div');
        chartContainer.id = 'chart-container';
        chartContainer.innerHTML = `
            <div id="chart-wrapper" style="display:none; position: absolute; transform: translateX(-50%); left: 50%; top: 50%; z-index: 1000; background: white; padding: 20px; border: 1px solid #ccc; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 class="chart-title">Évolution des Salaires et Consommation de Poisson</h2>
                <div id="chart"></div>
            </div>
        `;
        document.body.appendChild(chartContainer);
    }

    function createCombinationChart() {
        console.log("Création du graphique combiné");
        // Nettoyer le conteneur avant de créer un nouveau graphique
        d3.select("#chart").selectAll("*").remove();

        const margin = { top: 50, right: 60, bottom: 50, left: 50 };
        const width = 700 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        const svg = d3.select("#chart")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Charger les deux fichiers CSV en parallèle
        Promise.all([
            d3.csv("../csv/salaires-fr.csv"),
            d3.csv("../csv/conso-poisson.csv"),
            d3.csv("../csv/prix-poisson.csv")
        ]).then(([salaryData, animalData, priceData]) => {
            // Préparer les données pour le graphique
            salaryData.forEach(d => {
                d.année = +d.année;
                d.ensemble = +d.ensemble;
            });

            animalData.forEach(d => {
                d.année = +d.année;
                d.conso_poisson = +d.conso_poisson;
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
                    conso_poisson: animal ? animal.conso_poisson : null,
                    prix_moy: price ? price.prix_moy : null
                };
            });

            console.log("Données combinées :", mergedData);

            // Échelles
            const x = d3.scaleLinear()
                .domain(d3.extent(mergedData, d => d.année))
                .range([0, width]);

            const yLeft = d3.scaleLinear()
                .domain([90, 120]) // Échelle pour les salaires
                .range([height, 0]);

            const yRight = d3.scaleLinear()
                .domain([0, d3.max(mergedData, d => d.conso_poisson)+10]) // Échelle pour la consommation
                .range([height, 0]);

            const yRight2 = d3.scaleLinear()
                .domain([0, d3.max(mergedData, d => d.prix_moy)]) // Échelle pour le prix
                .range([height, 0]);


            // Axes
            // Axe X
            svg.append("g")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(x).tickFormat(d3.format("d")))
                .attr("stroke", "#333"); // Couleur de l'axe X

            // Axe Y pour les salaires
            svg.append("g")
                .call(d3.axisLeft(yLeft))
                .attr("color", "#6fc1d3"); // Couleur de l'axe Y pour les salaires

            // Axe Y pour la consommation de poisson
            svg.append("g")
                .attr("transform", `translate(${width},0)`)
                .call(d3.axisRight(yRight))
                .attr("color", "rgb(0 63 102)"); // Couleur de l'axe Y pour la consommation de poisson

            // Axe Y pour le prix moyen
            svg.append("g")
                .attr("transform", `translate(${width + 30},0)`)
                .call(d3.axisRight(yRight2))
                .attr("color", "rgb(168 199 250)"); // Couleur de l'axe Y pour le prix moyen

            // Barres pour la consommation de poisson
            svg.selectAll(".bar-conso")
                .data(mergedData)
                .enter()
                .append("rect")
                .attr("class", "bar")
                .attr("x", d => x(d.année) - 10) // Ajuster la position horizontale
                .attr("y", d => yRight(d.conso_poisson))
                .attr("width", 10) // Largeur des barres
                .attr("height", d => height - yRight(d.conso_poisson))
                .attr("fill", "rgb(0 63 102)");
                

            // Barres pour le prix de poisson
            svg.selectAll(".bar-price")
                .data(mergedData)
                .enter()
                .append("rect")
                .attr("class", "bar")
                .attr("x", d => x(d.année)) // Ajuster la position horizontale
                .attr("y", d => yRight2(d.prix_moy))
                .attr("width", 10) // Largeur des barres
                .attr("height", d => height - yRight2(d.prix_moy))
                .attr("fill", "rgb(168 199 250)");

            // Courbe pour les salaires
            const line = d3.line()
                .x(d => x(d.année))
                .y(d => yLeft(d.ensemble));

            svg.append("path")
                .datum(mergedData)
                .attr("fill", "none")
                .attr("stroke", "#6fc1d3")
                .attr("stroke-width", 2)
                .attr("d", line);

            // Légende
            const legend = svg.append("g")
                .attr("transform", `translate(${width / 3 - 100}, ${height + 30})`); // Positionner la légende au centre en bas du graphique

            // Légende pour l'indice de salaire
            legend.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", 10)
                .attr("height", 10)
                .attr("fill", "#6fc1d3"); // Couleur de la courbe des salaires

            legend.append("text")
                .attr("x", 15)
                .attr("y", 10)
                .text("Indice de Salaire") // Texte explicatif
                .style("font-size", "12px")
                .attr("fill", "#6fc1d3");

            // Légende pour la consommation de poisson
            legend.append("rect")
                .attr("x", 120) // Décalage horizontal
                .attr("y", 0)
                .attr("width", 10)
                .attr("height", 10)
                .attr("fill", "rgb(0 63 102)"); // Couleur des barres de consommation de poisson

            legend.append("text")
                .attr("x", 135) // Décalage horizontal
                .attr("y", 10)
                .text("Consommation de Poisson (kg/hab)")
                .style("font-size", "12px")
                .attr("fill", "rgb(0 63 102)");

            // Légende pour le prix moyen
            legend.append("rect")
                .attr("x", 340) // Décalage horizontal
                .attr("y", 0)
                .attr("width", 10)
                .attr("height", 10)
                .attr("fill", "rgb(168 199 250)"); // Couleur des barres du prix moyen

            legend.append("text")
                .attr("x", 355) // Décalage horizontal
                .attr("y", 10)
                .text("Prix Moyen (€)")
                .style("font-size", "12px")
                .attr("fill", "rgb(168 199 250)");

                const yRightAxis = svg.append("g")
    .attr("transform", `translate(${width},0)`)
    .call(d3.axisRight(yRight))  // Axe pour la consommation de poisson
    .attr("stroke", "rgb(0 63 102)");
                // Récupérer les ticks de l'axe de la consommation de poisson (yRight)
const consumptionTicks = yRightAxis.selectAll(".tick");

consumptionTicks.each(function(d) {
    svg.append("line")
        .attr("x1", 0)
        .attr("y1", yRight(d))
        .attr("x2", width)
        .attr("y2", yRight(d))
        .attr("stroke", "#000000")
        .attr("stroke-dasharray", "5,5")
        .attr("stroke-width", 0.5);
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
            console.log('Animal cliqué : ' + this.getAttribute('alt'));

            animals.forEach(a => a.classList.remove('active'));

            if (!this.classList.contains('active')) {
                this.classList.add('active');

                if (this.getAttribute('alt') === 'Saumon') {
                    createCombinationChart(); // Crée le graphique combiné
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