document.addEventListener("DOMContentLoaded", async() => {
    console.log(d3);
    debugger
    // Chargement des données
    const data = await d3.csv("./../csv/meat-prices.csv", d => ({
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

    // Dimensions du graphique
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // Création du graphique
    const svg = d3.select("#chart-price1")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
    console.log(data)

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

});