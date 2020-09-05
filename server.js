const express = require('express');
const app = express();
const path = require("path");
const fs  = require("fs");
const bodyParser = require("body-parser");
const cors = require("cors");
const parse = require('csv-parser');
const pdf = require("html-pdf");
const ejs = require("ejs");
const flash = require("connect-flash");
const lowercaseKeys = require("lowercase-keys");
const fileUpload = require('express-fileupload');

app.use(require("express-session")({
	secret: "Charles built this",
	resave: false,
	saveUninitialized: false
}));
app.set("view engine", "ejs");
app.use(fileUpload());
app.use(express.static(path.join(__dirname,"public")));
app.use(express.json());
app.use(flash());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(function(req, res, next){
	res.locals.error = req.flash("error");
	
	res.locals.success = req.flash("success");
	next();
});



app.get("/test", function(req, res){
    res.send({"success":"Welcome to ECX-Unilag Certification System. Charles Ugbana built this!"});
})

app.get("/admin", function(req, res){
    res.render("admin/index");
})

app.get("/", function(req, res){
    res.render("landing/index");
})

app.post('/api/upload', cors(), function(req, res) {
    if(req.body.secret !== process.env.secret){
        req.flash("error", "Unauthorised!");
        return res.redirect("/admin")
    }
    if (!req.files || Object.keys(req.files).length === 0) {
        req.flash("error", "No file was uploaded.");
        return res.redirect("/admin"); 
    }
    const stringFile = req.files.sampleFile.name;
    if(stringFile.substr(stringFile.indexOf('.')) !== ".csv" || !stringFile.includes(".")){
        req.flash("error", "Error. Please upload a .csv file");
        return res.redirect("/admin");  
    }
    var sampleFile = req.files.sampleFile,
                        file = sampleFile.name;
    fs.readdir("./tmp/csv/", function(err, files) {
        if (err) {
            req.flash("error", "Something went wrong. Please try again.");
            return res.redirect("/admin");
        } else {
            if(!files.length){
                
                sampleFile.mv( "./tmp/csv/"+file, function(err) {
                    if (err){
                        req.flash("error", "Something went wrong. Please upload again.");
                        return res.redirect("/admin");
                    }else{
                        req.flash("success", "File upload successful");
                        return res.redirect("/admin");}
                });
            }else{
                for (const staleFile of files) {
                    fs.unlink(path.join("./tmp/csv/", staleFile), function(err) {
                          if (err)
                            { req.flash("error", "Something went wrong. Please upload again.");
                            return res.redirect("/admin");}
                          else{
                            sampleFile.mv( "./tmp/csv/"+file, function(err) {
                                if (err){
                                    req.flash("error", "Something went wrong. Please upload again.");
                                    return res.redirect("/admin");}
                                else{
                                    req.flash("success", "File upload successful");
                                    return res.redirect("/admin");}
                    });
                }
            })
        }}}
    })
});



app.post('/api/verification', cors, function (req, res) {
  fs.readdir(__dirname+"/tmp/csv/", function(err, file) {
      console.log(file)
      if(!file){
        req.flash("error", "Service is not available now. Try again later.");
        return res.redirect("/");
         
      }else{
       const results = [];
        fs.createReadStream('./tmp/csv/'+file)
        .pipe(parse())
        .on('data', (data) => results.push(data))
        .on('end', () => {
        var item = results.find(item => item.email === req.body.email);
           if(item){
                item = lowercaseKeys(item)
                req.flash("success", "Certificate generate.");
                return res.redirect("/api/generateCert/"+item.name +"/" + item.track)
           }else{
            req.flash("error", "Sorry, you are not eligible for certification.");
            return res.redirect("/");
           }
      
     });
    }
        
  })
  
});

app.get("/api/generateCert/:username/:track", cors(), (req, res) => {
    ejs.renderFile(path.join(__dirname, '/views/certificate', "index.ejs"), {student: req.params.username, 
        track: req.params.track}, (err, data) => {
    if (err) {
          res.send(err);
    } else {
        let options = {
            "height": "11.25in",
            "width": "8.5in",
            "header": {
                "height": "20mm"
            },
            "footer": {
                "height": "20mm",
            },
        };
        pdf.create(data, options).toFile( `${req.params.username}.pdf`, function (err, data) {
            if (err) {
                req.flash("error", "Something went wrong. Please try again.");
                return res.redirect("/");
            } else {
                res.download(`${req.params.username}.pdf`, (err)=>{
                    if(err){
                        req.flash("error", "Something went wrong. Please try again.");
                        return res.redirect("/");
                    }else{
                        fs.unlink(path.join(`./${req.params.username}.pdf`), (err)=> {
                            if (err){
                              console.log(err)
                            }else{
                                console.log("Certificate deleted from server.")
                            }
                        })
                    }
                
                });
                
            }
        });
    }
});
})


app.listen(process.env.PORT, function () {
    console.log('Express server listening on ', process.env.PORT);
  });


