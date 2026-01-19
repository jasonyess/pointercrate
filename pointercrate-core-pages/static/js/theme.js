$(window).on("load", function () {
    let themeToggle = document.getElementById("theme-toggle");

    themeToggle.parentElement.addEventListener("click", () => {
        let newTheme = document.documentElement.dataset.theme == "light" ? "dark" : "light";
        
        let exp = new Date();
        exp.setFullYear(exp.getFullYear() + 1);

        document.cookie = `preference-theme=${newTheme}; expires=${exp.toUTCString()}; path=/;`;

        window.location.reload();
    })
})