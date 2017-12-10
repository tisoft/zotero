/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009-2011 Center for History and New Media
                          George Mason University, Fairfax, Virginia, USA
                          http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

/**
 * Handles UI for lookup panel
 * @namespace
 */
var Zotero_Lookup = new function () {
	/**
	 * Performs a lookup by DOI, PMID, or ISBN
	 */
	this.accept = Zotero.Promise.coroutine(function* (textBox) {
		var identifiers = Zotero.Utilities.Internal.extractIdentifiers(textBox.value);
		if (!identifiers.length) {
			Zotero.alert(
				window,
				Zotero.getString("lookup.failure.title"),
				Zotero.getString("lookup.failureToID.description")
			);
			return false;
		}

		var libraryID = false;
		var collection = false;
		try {
			libraryID = ZoteroPane_Local.getSelectedLibraryID();
			collection = ZoteroPane_Local.getSelectedCollection();
		} catch(e) {
			/** TODO: handle this **/
		}

		var successful = 0;					//counter for successful retrievals

		Zotero_Lookup.toggleProgress(true);

		for (let identifier of identifiers) {
			var translate = new Zotero.Translate.Search();
			translate.setIdentifier(identifier);

			// be lenient about translators
			let translators = yield translate.getTranslators();
			translate.setTranslator(translators);

			try {
				yield translate.translate({
					libraryID,
					collections: collection ? [collection.id] : false
				})
				successful++;
			}
			// Continue with other ids on failure
			catch (e) {
				Zotero.logError(e);
			}
		}
		
		Zotero_Lookup.toggleProgress(false);
		// TODO: Give indication if some failed
		if (successful) {
			document.getElementById("zotero-lookup-panel").hidePopup();
		}
		else {
			Zotero.alert(
				window,
				Zotero.getString("lookup.failure.title"),
				Zotero.getString("lookup.failure.description")
			);
		}
		
		return false;
	});
	
	/**
	 * Handles a key press
	 */
	this.onKeyPress = function(event, textBox) {
		var keyCode = event.keyCode;
		//use enter to start search, shift+enter to insert a new line. Flipped in multiline mode
		var multiline = textBox.getAttribute('multiline');
		var search = multiline ? event.shiftKey : !event.shiftKey;
		if(keyCode === 13 || keyCode === 14) {
			if(search) {
				Zotero_Lookup.accept(textBox);
				event.stopImmediatePropagation();
			} else if(!multiline) {	//switch to multiline
				var mlTextbox = Zotero_Lookup.toggleMultiline(true);
				mlTextbox.value = mlTextbox.value + '\n';
			}
		} else if(keyCode == event.DOM_VK_ESCAPE) {
			document.getElementById("zotero-lookup-panel").hidePopup();
		}
		return true;
	}
	
	/**
	 * Focuses the field
	 */
	this.onShowing = function (event) {
		// Ignore context menu
		if (event.originalTarget.id != 'zotero-lookup-panel') return;
		
		document.getElementById("zotero-lookup-panel").style.padding = "10px";
		
		// Workaround for field being truncated in middle
		// https://github.com/zotero/zotero/issues/343
		this.toggleMultiline(true);
		
		var identifierElement = Zotero_Lookup.toggleMultiline(false);
		Zotero_Lookup.toggleProgress(false);
		identifierElement.focus();
	}
	
	/**
	 * Cancels the popup and resets fields
	 */
	this.onHidden = function (event) {
		// Ignore context menu to prevent blanking on paste
		if (event.originalTarget.id != 'zotero-lookup-panel') return;
		
		var txtBox = Zotero_Lookup.toggleMultiline(false);
		var mlTextbox = document.getElementById("zotero-lookup-multiline-textbox");
		txtBox.value = "";
		mlTextbox.value = "";
	}

	/**
	 * Converts the textbox to multiline if newlines are detected
	 */
	this.adjustTextbox = function(txtBox) {
		if(txtBox.value.trim().match(/[\r\n]/)) {
			Zotero_Lookup.toggleMultiline(true);
		} else {
			//since we ignore trailing and leading newlines, we should also trim them for display
			//can't use trim, because then we cannot add leading/trailing spaces to the single line textbox
			txtBox.value = txtBox.value.replace(/^([ \t]*[\r\n]+[ \t]*)+|([ \t]*[\r\n]+[ \t]*)+$/g,"");
		}
	}

	/**
	 * Performs the switch to multiline textbox and returns that textbox
	 */
	this.toggleMultiline = function(on) {
		var mlPanel = document.getElementById("zotero-lookup-multiline");
		var mlTxtBox = document.getElementById("zotero-lookup-multiline-textbox");
		var slPanel = document.getElementById("zotero-lookup-singleLine");
		var slTxtBox = document.getElementById("zotero-lookup-textbox");
		var source = on ? slTxtBox : mlTxtBox;
		var dest = on ? mlTxtBox : slTxtBox;

		if((mlPanel.collapsed && !on) || (!mlPanel.collapsed && on)) return dest;

		//copy over the value
		dest.value = source.value;

		//switch textboxes
		mlPanel.setAttribute("collapsed", !on);
		slPanel.setAttribute("collapsed", !!on);

		// Resize arrow box to fit content
		if(Zotero.isMac) {
			var panel = document.getElementById("zotero-lookup-panel");
			var box = panel.firstChild;
			panel.sizeTo(box.scrollWidth, box.scrollHeight);
		}

		dest.focus();
		return dest;
	}

	this.toggleProgress = function(on) {
		//single line
		var txtBox = document.getElementById("zotero-lookup-textbox");
		txtBox.style.opacity = on ? 0.5 : 1;
		txtBox.disabled = !!on;
		document.getElementById("zotero-lookup-progress").setAttribute("collapsed", !on);

		//multiline
		document.getElementById("zotero-lookup-multiline-textbox").disabled = !!on;
		document.getElementById("zotero-lookup-multiline-progress").setAttribute("collapsed", !on);
	}

	this.getActivePanel = function() {
		var mlPanel = document.getElementById("zotero-lookup-multiline");
		if(mlPanel.collapsed) return document.getElementById("zotero-lookup-singleLine");

		return mlPanel;
	}
}
