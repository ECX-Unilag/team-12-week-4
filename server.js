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
const jimp = require("jimp");
const imagesToPdf = require("images-to-pdf");

app.use(require("express-session")({
	secret: "Charles built this",
	resave: false,
	saveUninitialized: false
}));
app.use(cors());
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


app.post('/api/upload',  function(req, res) {
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
                                    req.flash("error", "Something went wrong. Please try again.");
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



app.post('/api/user/verification',  function (req, res) {
  fs.readdir("./tmp/csv/", function(err, file) {
      if(file.length === 0){
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
                if(item.track !== "Mentor"){
                    return res.redirect("/api/generateCert/"+item.name +"/" + item.track)
                }else{
                    return res.redirect("/api/generateCert/"+item.name)
                }     
           }else{
            req.flash("error", "Sorry, you are not eligible for certification.");
            return res.redirect("/");
           }
      
     });

    }
        
  })
  
});


async function interns(name, track){
    const image = await jimp.read("https://res.cloudinary.com/charlene04/image/upload/v1600532444/ecx_cert_lyetl0.jpg");
    const font = await jimp.loadFont(jimp.FONT_SANS_32_BLACK);
    image.print(font, 0, 0, name);
    image.print(font, 100, 100, track);
    await image.write("./"+name+".png");
    await imagesToPdf("./"+name+".png", "./"+name+".pdf");
    
};

async function mentors(name){
    const image = await jimp.read("https://res.cloudinary.com/charlene04/image/upload/v1600532630/ecx_Mentor_pcnfx5.jpg");
    const font = await jimp.loadFont(jimp.FONT_SANS_32_BLACK);
    image.print(font, x, y, name );
    await image.write("./"+name+".png");
    
};


app.get("/api/generateCert/:username/:track", async (req, res) => {
    const fullname = req.params.username.toUpperCase();
    const devtrack = req.params.track.toUpperCase();
    await interns(fullname, devtrack)
    res.download(`./${fullname}.png`, (err)=>{
            if(err){
                req.flash("error", "Something went wrong. Please try again.");
                return res.redirect("/");
            }else{
                fs.unlink(path.join(`./${fullname}.png`), (err)=> {
                    if (err){
                      console.log(err)
                    }else{
                        console.log("Certificate deleted from server.")
                    }
                })
            }
        
        });
   
})

app.get("/api/generateCert/:username", async (req, res) => {
    const fullname = req.params.username.toUpperCase();
    await mentors(fullname)
    res.download(`./${fullname}.png`, (err)=>{
            if(err){
                req.flash("error", "Something went wrong. Please try again.");
                return res.redirect("/");
            }else{
                fs.unlink(path.join(`./${fullname}.png`), (err)=> {
                    if (err){
                      console.log(err)
                    }else{
                        console.log("Certificate deleted from server.")
                    }
                })
            }
        
        });
})

/*
=========================================================================
THESE ROUTES ARE FOR RENDERING HTML FILE INTO PDF
==============================================================================

app.get("/api/generateCert/:username/:track", (req, res) => {
      ejs.renderFile(path.join(__dirname, '/views/certificate', "index.ejs"), {student: req.params.username, 
        track: req.params.track}, (err, data) => {
    if (err) {
          res.send(err);
    } else {
        let options = {
            "format":"A4",
            "orientation":"landscape"
            //210 297 
        };
        pdf.create(data, options).toFile( `${req.params.username}.pdf`, function (err, data) {
            if (err) {
                req.flash("error", "Something went wrong. Please try again.");
                return res.redirect("/");
            } else {
                res.download(`./${req.params.username}.pdf`, (err)=>{
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

app.get("/api/generateCert/:username", (req, res) => {
    ejs.renderFile(path.join(__dirname, '/views/certificate', "mentor.ejs"), {mentor: req.params.username}, (err, data) => {
  if (err) {
        res.send(err);
  } else {
      let options = {
          "height":"210mm",
          "width":"297mm",  
      };
      pdf.create(data, options).toFile( `${req.params.username}.pdf`, function (err, data) {
          if (err) {
              req.flash("error", "Something went wrong. Please try again.");
              return res.redirect("/");
          } else {
              res.download(`./${req.params.username}.pdf`, (err)=>{
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
*/


  


app.listen(process.env.PORT || 3000, function () {
    console.log('Express server listening on ', process.env.PORT);
  });


