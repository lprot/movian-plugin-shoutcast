/*
 *  SHOUTcast plugin for Movian Media Center
 *
 *  Copyright (C) 2015-2018 lprot
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var page = require('showtime/page');
var service = require('showtime/service');
var settings = require('showtime/settings');
var http = require('showtime/http');
var string = require('native/string');
var popup = require('native/popup');
var XML = require('showtime/xml');
var plugin = JSON.parse(Plugin.manifest);
var logo = Plugin.path + plugin.icon;

RichText = function(x) {
    this.str = x.toString();
}

RichText.prototype.toRichString = function(x) {
    return this.str;
}

function setPageHeader(page, title) {
    page.type = "directory";
    page.contents = "items";
    page.metadata.logo = logo;
    page.metadata.title = new RichText(title);
}

var blue = '6699CC', orange = 'FFA500', red = 'EE0000', green = '008B45';
function colorStr(str, color) {
    return '<font color="' + color + '"> (' + str + ')</font>';
}

function coloredStr(str, color) {
    return '<font color="' + color + '">' + str + '</font>';
}

function trim(s) {
    if (s) return s.replace(/(\r\n|\n|\r)/gm, "").replace(/(^\s*)|(\s*$)/gi, "").replace(/[ ]{2,}/gi, " ").replace(/\t/g, '');
    return '';
}

var API = "http://api.shoutcast.com", k = 'sh1t7hyn3Kh0jhlV';

var store = require('movian/store').create('favorites');
if (!store.list) 
    store.list = "[]";

service.create(plugin.title, plugin.id + ":start", 'music', true, logo);

settings.globalSettings(plugin.id, plugin.title, logo, plugin.synopsis);
settings.createAction("cleanFavorites", "Clean My Favorites", function() {
    store.list = "[]";
    popup.notify('My Favorites has been successfully cleaned.', 2);
});

new page.Route(plugin.id + ":favorites", function(page) {
    setPageHeader(page, "My Favorites");
    var list = eval(store.list);
    if (!list || !list.toString()) {
        page.error("My Favorites list is empty");
        return;
    }

    var pos = 0;
    for (var i in list) {
	var itemmd = JSON.parse(list[i]);
	var item = page.appendItem(itemmd.url, "station", {
	     title: itemmd.station,
             icon: logo
	});
        removeItemFromMyFavorites(item, pos);
        pos++;
    }
});

function removeItemFromMyFavorites(item, pos) {
    item.addOptAction("Remove '" + item.station + "' from My Favorites", function() {
        var list = eval(store.list);
        popup.notify("'" + item.station + "' has been removed from My Favorites.", 2);
	list.splice(pos, 1);
	store.list = JSON.stringify(list);
        page.flush();
        page.redirect(plugin.id + ':favorites');
    });
};

new page.Route(plugin.id + ":genresearch:(.*):(.*)", function(page, id, title) {
    setPageHeader(page, plugin.title + ' - ' + unescape(title));
    getXMLfromAPI(page, API+'/legacy/genresearch?k=' + k + '&genre=' + string.entityDecode(unescape(title)).replace(/\s/g,'\+'));
});

new page.Route(plugin.id + ":subgenre:(.*):(.*)", function(page, id, title) {
    setPageHeader(page, plugin.title + ' - ' + unescape(title));
    page.loading = true;
    var json = JSON.parse(http.request(API + '/genre/secondary?parentid=' + id + '&k=' + k + '&f=json').toString());
    page.loading = false;

    if (json.response.data.genrelist.genre) {
        for (var i in json.response.data.genrelist.genre) {
            var genre = json.response.data.genrelist.genre[i];
	    page.appendItem(plugin.id + ":genresearch:"+genre.id+":"+escape(genre.name), "directory", {
                title: string.entityDecode(genre.name)
            });
        };
    }
});

new page.Route(plugin.id + ":genres", function(page) {
    setPageHeader(page, plugin.title + ' - Genres');
    page.loading = true;
    var json = JSON.parse(http.request(API + '/genre/primary?k=' + k + '&f=json').toString());
    page.loading = false;
    for (var i in json.response.data.genrelist.genre) {
        var genre = json.response.data.genrelist.genre[i];
        page.appendItem(plugin.id + (genre.haschildren ? ':subgenre:' : ':genresearch:') + genre.id+":"+escape(genre.name), "directory", {
	    title: string.entityDecode(genre.name)
     	});
    };
});

function addItemToFavoritesOption(item) {
    item.addOptAction("Add '" + item.title + "' to My Favorites", function() {
        var entry = JSON.stringify({
            url: item.url,
            title: item.title,
            station: item.station
        });
        store.list = JSON.stringify([entry].concat(eval(store.list)));
        popup.notify("'" + item.station + "' has been added to My Favorites.", 2);
    });
};

new page.Route(plugin.id + ":random", function(page) {
    setPageHeader(page, '500 Random Stations');
    page.loading = true;
    var doc = http.request(API + '/station/randomstations?k=' + k + '&f=xml').toString();
    var xml = XML.parse(doc).response.data.stationlist;
    page.loading = false;
    if (!xml) return tryToSearch = false;
    var stations = xml.filterNodes('station');
    for(var i = 0; i < stations.length; i++) {
        var title = stations[i]["@name"] + colorStr(stations[i]["@genre"], orange) + ' ' +
            coloredStr(stations[i]["@mt"].replace('audio/mpeg', 'MP3').replace('audio/aacp', 'AAC+'), blue) + ' ' +
            coloredStr(stations[i]["@br"], orange) + ' ' + coloredStr(stations[i]["@lc"], green);
        var item = page.appendItem('icecast:http://yp.shoutcast.com/sbin/tunein-station.pls?id=' + stations[i]["@id"], "station", {
            title: new RichText(title),
            icon: logo
        });
        item.url = 'icecast:http://yp.shoutcast.com/sbin/tunein-station.pls?id=' + stations[i]["@id"];
        item.title = title;
        item.station = stations[i]["@name"];
        addItemToFavoritesOption(item);
        page.entries++;
    };
    page.loading = false;
});

function getXMLfromAPI(page, url) {
    page.entries = 0;
    var tryToSearch = true, offset = 0;

    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
        var doc = http.request(url + '&limit=' + offset + ',20').toString();
        var xml = XML.parse(doc).stationlist;
        page.loading = false;
        if (!xml) return tryToSearch = false;
        var stations = xml.filterNodes('station');
        for(var i = 0; i < stations.length; i++) {
            var title = stations[i]["@name"] + colorStr(stations[i]["@genre"], orange) + ' ' +
                    coloredStr(stations[i]["@mt"].replace('audio/mpeg', 'MP3').replace('audio/aacp', 'AAC+'), blue) + ' ' +
                    coloredStr(stations[i]["@br"], orange) + ' ' + coloredStr(stations[i]["@lc"], green);
            var item = page.appendItem('icecast:http://yp.shoutcast.com/sbin/tunein-station.pls?id=' + stations[i]["@id"], "station", {
                title: new RichText(title),
                icon: logo
	    });
            item.url = 'icecast:http://yp.shoutcast.com/sbin/tunein-station.pls?id=' + stations[i]["@id"];
            item.title = title;
            item.station = stations[i]["@name"];
            addItemToFavoritesOption(item);
            page.entries++;
        };
        if (page.entries <= offset) return tryToSearch = false;
        offset += 20;
        return true;
    }
    loader();
    page.paginator = loader;
}

new page.Route(plugin.id + ":start", function(page) {
    setPageHeader(page, plugin.synopsis);
    page.appendItem(plugin.id + ":search:", 'search', {
        title: 'Search at ' + API
    });
    page.appendItem(plugin.id + ":genres", "directory", {
        title: "Genres"
    });
    page.appendItem(plugin.id + ":random", "directory", {
        title: "500 Random Stations"
    });
    //page.appendItem(plugin.id + ":favorites", "directory", {
    //    title: "My Favorites"
    //});
    page.appendItem("", "separator", {
        title: 'Top 500 Stations'
    });
    getXMLfromAPI(page, API + '/legacy/Top500?k=' + k);
});

new page.Route(plugin.id + ":search:(.*)", function(page, query) {
    setPageHeader(page, plugin.synopsis + ' / ' + query);
    getXMLfromAPI(page, API + '/legacy/stationsearch?k=' + k + '&search=' + encodeURI(query));
});

page.Searcher("Shoutcast", logo, function(page, query) {
    getXMLfromAPI(page, API + '/legacy/stationsearch?k=' + k + '&search=' + encodeURI(query));
});
